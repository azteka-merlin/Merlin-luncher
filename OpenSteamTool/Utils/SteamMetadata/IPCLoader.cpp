#include "IPCLoader.h"
#include "IPCMessages.gen.h"
#include "Utils/Logging/Log.h"
#include "Utils/SteamMetadata/SteamDiagnostics.h"

#include <windows.h>

#include <algorithm>
#include <array>
#include <filesystem>
#include <fstream>
#include <map>
#include <optional>
#include <set>
#include <span>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace IPCLoader {

namespace {

    struct IpcMethodSeed {
        const char* name;
        uint32_t methodIndex;
        uint32_t funcHash;
        uint32_t fencepost;
        uint32_t argc;
    };

    struct IpcInterfaceSeed {
        const char* name;
        std::span<const IpcMethodSeed> methods;
    };

    constexpr IpcMethodSeed kIClientUserMethods[] = {
        {"GetSteamID", 10, 0xD6FC3200u, 0xD7058CA5u, 0},
        {"GetAppOwnershipTicketExtendedData", 105, 0xC7E71245u, 0xC8449840u, 2},
        {"RequestEncryptedAppTicket", 120, 0x25D6BB1Du, 0x2646B663u, 2},
        {"GetEncryptedAppTicket", 121, 0xE0468CB4u, 0xE0B80200u, 1},
    };

    constexpr IpcMethodSeed kIClientUtilsMethods[] = {
        {"GetAppID", 19, 0x09607EC4u, 0x0AFE7552u, 0},
        {"GetAPICallResult", 24, 0x2D3D3947u, 0x2EDF5EE6u, 3},
    };

    constexpr IpcInterfaceSeed kIpcInterfaces[] = {
        {"IClientUser", std::span<const IpcMethodSeed>(kIClientUserMethods)},
        {"IClientUtils", std::span<const IpcMethodSeed>(kIClientUtilsMethods)},
    };

    struct SectionInfo {
        uint32_t virtualAddress = 0;
        uint32_t virtualSize = 0;
        uint32_t rawOffset = 0;
        uint32_t rawSize = 0;
        bool executable = false;
        bool initializedData = false;
    };

    struct RuntimeFunction {
        uint32_t beginRva = 0;
        uint32_t endRva = 0;
    };

    struct PortableExecutable {
        uint64_t imageBase = 0;
        uint32_t exceptionTableRva = 0;
        uint32_t exceptionTableSize = 0;
        std::vector<SectionInfo> sections;
    };

    struct Registry {
        std::vector<Interface> interfaces;
        std::unordered_map<EIPCInterface, size_t> byID;
        std::unordered_map<std::string, size_t> byName;

        void Clear()
        {
            interfaces.clear();
            byID.clear();
            byName.clear();
        }

        void Add(Interface iface)
        {
            const size_t index = interfaces.size();
            byID[iface.id] = index;
            byName[iface.name] = index;
            interfaces.push_back(std::move(iface));
        }

        const Method* Find(EIPCInterface interfaceID, uint32_t funcHash) const
        {
            const auto it = byID.find(interfaceID);
            if (it == byID.end()) return nullptr;

            for (const auto& method : interfaces[it->second].methods) {
                if (method.funcHash == funcHash) return &method;
            }
            return nullptr;
        }

        const Method* Find(std::string_view interfaceName,
                           std::string_view methodName) const
        {
            const auto it = byName.find(std::string(interfaceName));
            if (it == byName.end()) return nullptr;

            for (const auto& method : interfaces[it->second].methods) {
                if (method.name == methodName) return &method;
            }
            return nullptr;
        }

        size_t MethodCount() const
        {
            size_t count = 0;
            for (const auto& iface : interfaces) {
                count += iface.methods.size();
            }
            return count;
        }
    };

    Registry g_registry;

    std::optional<std::vector<uint8_t>> ReadFileBytes(const std::string& path)
    {
        std::ifstream ifs(path, std::ios::binary);
        if (!ifs) return std::nullopt;
        return std::vector<uint8_t>(std::istreambuf_iterator<char>(ifs), std::istreambuf_iterator<char>());
    }

    std::optional<PortableExecutable> ParsePe64(const std::vector<uint8_t>& buffer)
    {
        if (buffer.size() < sizeof(IMAGE_DOS_HEADER)) return std::nullopt;

        const auto* dos = reinterpret_cast<const IMAGE_DOS_HEADER*>(buffer.data());
        if (dos->e_magic != IMAGE_DOS_SIGNATURE) return std::nullopt;
        if (dos->e_lfanew <= 0 || static_cast<size_t>(dos->e_lfanew) + sizeof(IMAGE_NT_HEADERS64) > buffer.size()) {
            return std::nullopt;
        }

        const auto* nt = reinterpret_cast<const IMAGE_NT_HEADERS64*>(buffer.data() + dos->e_lfanew);
        if (nt->Signature != IMAGE_NT_SIGNATURE) return std::nullopt;
        if (nt->OptionalHeader.Magic != IMAGE_NT_OPTIONAL_HDR64_MAGIC) return std::nullopt;

        PortableExecutable pe;
        pe.imageBase = nt->OptionalHeader.ImageBase;
        pe.exceptionTableRva = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXCEPTION].VirtualAddress;
        pe.exceptionTableSize = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXCEPTION].Size;

        const auto* section = IMAGE_FIRST_SECTION(nt);
        for (unsigned i = 0; i < nt->FileHeader.NumberOfSections; ++i, ++section) {
            SectionInfo info;
            info.virtualAddress = section->VirtualAddress;
            info.virtualSize = section->Misc.VirtualSize;
            info.rawOffset = section->PointerToRawData;
            info.rawSize = section->SizeOfRawData;
            info.executable = (section->Characteristics & IMAGE_SCN_MEM_EXECUTE) != 0;
            info.initializedData =
                (section->Characteristics & IMAGE_SCN_CNT_INITIALIZED_DATA) != 0
                || (section->Characteristics & IMAGE_SCN_CNT_UNINITIALIZED_DATA) != 0;
            pe.sections.push_back(info);
        }

        return pe;
    }

    std::optional<uint32_t> FileOffsetToRva(const PortableExecutable& pe, uint32_t fileOffset)
    {
        for (const auto& section : pe.sections) {
            if (fileOffset >= section.rawOffset && fileOffset < section.rawOffset + section.rawSize) {
                return section.virtualAddress + (fileOffset - section.rawOffset);
            }
        }
        return std::nullopt;
    }

    std::optional<uint32_t> RvaToFileOffset(const PortableExecutable& pe, uint32_t rva)
    {
        for (const auto& section : pe.sections) {
            const uint32_t size = (std::max)(section.virtualSize, section.rawSize);
            if (rva >= section.virtualAddress && rva < section.virtualAddress + size) {
                return section.rawOffset + (rva - section.virtualAddress);
            }
        }
        return std::nullopt;
    }

    bool IsExecutableRva(const PortableExecutable& pe, uint32_t rva)
    {
        for (const auto& section : pe.sections) {
            const uint32_t size = (std::max)(section.virtualSize, section.rawSize);
            if (rva >= section.virtualAddress && rva < section.virtualAddress + size) {
                return section.executable;
            }
        }
        return false;
    }

    std::vector<RuntimeFunction> ParseRuntimeFunctions(const PortableExecutable& pe, const std::vector<uint8_t>& buffer)
    {
        std::vector<RuntimeFunction> out;
        if (!pe.exceptionTableRva || !pe.exceptionTableSize) return out;

        const auto tableOffset = RvaToFileOffset(pe, pe.exceptionTableRva);
        if (!tableOffset) return out;

        const uint32_t count = pe.exceptionTableSize / sizeof(IMAGE_RUNTIME_FUNCTION_ENTRY);
        for (uint32_t i = 0; i < count; ++i) {
            const auto entryOffset = *tableOffset + i * sizeof(IMAGE_RUNTIME_FUNCTION_ENTRY);
            if (entryOffset + sizeof(IMAGE_RUNTIME_FUNCTION_ENTRY) > buffer.size()) break;

            const auto* entry = reinterpret_cast<const IMAGE_RUNTIME_FUNCTION_ENTRY*>(buffer.data() + entryOffset);
            if (!entry->BeginAddress || !entry->EndAddress) continue;
            out.push_back({entry->BeginAddress, entry->EndAddress});
        }

        std::sort(out.begin(), out.end(), [](const RuntimeFunction& a, const RuntimeFunction& b) {
            return a.beginRva < b.beginRva;
        });
        return out;
    }

    const RuntimeFunction* FindRuntimeFunctionContaining(const std::vector<RuntimeFunction>& functions, uint32_t rva)
    {
        size_t lo = 0;
        size_t hi = functions.size();
        while (lo < hi) {
            const size_t mid = (lo + hi) / 2;
            const auto& item = functions[mid];
            if (rva < item.beginRva) hi = mid;
            else if (rva >= item.endRva) lo = mid + 1;
            else return &item;
        }
        return nullptr;
    }

    template <typename T>
    std::array<uint8_t, sizeof(T)> ToLeBytes(T value)
    {
        std::array<uint8_t, sizeof(T)> out{};
        for (size_t i = 0; i < sizeof(T); ++i) {
            out[i] = static_cast<uint8_t>((value >> (i * 8)) & 0xFF);
        }
        return out;
    }

    std::vector<uint32_t> FindAllRawMatches(const std::vector<uint8_t>& buffer,
                                            std::span<const uint8_t> bytes,
                                            const std::vector<SectionInfo>& sections,
                                            bool requireExecutable,
                                            bool requireInitializedData)
    {
        std::vector<uint32_t> out;
        if (bytes.empty()) return out;

        for (const auto& section : sections) {
            if (requireExecutable && !section.executable) continue;
            if (requireInitializedData && !section.initializedData) continue;

            const uint32_t start = section.rawOffset;
            const uint32_t end = (std::min<uint64_t>)(buffer.size(), static_cast<uint64_t>(section.rawOffset) + section.rawSize);
            if (end < start || end - start < bytes.size()) continue;

            for (uint32_t offset = start; offset + bytes.size() <= end; ++offset) {
                if (std::memcmp(buffer.data() + offset, bytes.data(), bytes.size()) == 0) {
                    out.push_back(offset);
                }
            }
        }

        return out;
    }

    bool BuildRegistryFromLiveSteamclient(const std::string& steamclientPath)
    {
        const auto bytesOpt = ReadFileBytes(steamclientPath);
        if (!bytesOpt) {
            LOG_WARN("IPCLoader: failed to read steamclient image from {}", steamclientPath);
            return false;
        }

        const auto peOpt = ParsePe64(*bytesOpt);
        if (!peOpt) {
            LOG_WARN("IPCLoader: failed to parse PE image from {}", steamclientPath);
            return false;
        }

        const auto runtimeFunctions = ParseRuntimeFunctions(*peOpt, *bytesOpt);
        if (runtimeFunctions.empty()) {
            LOG_WARN("IPCLoader: runtime function table is empty for {}", steamclientPath);
            return false;
        }

        Registry generated;

        for (const auto& ifaceSeed : kIpcInterfaces) {
            Interface iface;
            iface.name = ifaceSeed.name;

            const auto expected = EIPCInterfaceFromName(iface.name);
            if (!expected) {
                LOG_WARN("IPCLoader: live metadata interface {} missing from generated EIPCInterface", iface.name);
                return false;
            }
            iface.id = *expected;

            struct ResolvedMethod {
                Method method;
                uint32_t wrapperRva = 0;
            };

            std::vector<ResolvedMethod> resolvedMethods;
            resolvedMethods.reserve(ifaceSeed.methods.size());

            for (const auto& methodSeed : ifaceSeed.methods) {
                const auto fencepostBytes = ToLeBytes<uint32_t>(methodSeed.fencepost);
                const auto fencepostMatches = FindAllRawMatches(
                    *bytesOpt,
                    std::span<const uint8_t>(fencepostBytes),
                    peOpt->sections,
                    true,
                    false);

                if (fencepostMatches.size() != 1) {
                    LOG_WARN("IPCLoader: live metadata could not uniquely resolve fencepost for {}::{}",
                             iface.name, methodSeed.name);
                    return false;
                }

                const auto fencepostRva = FileOffsetToRva(*peOpt, fencepostMatches[0]);
                if (!fencepostRva) return false;

                const auto* runtimeFn = FindRuntimeFunctionContaining(runtimeFunctions, *fencepostRva);
                if (!runtimeFn) {
                    LOG_WARN("IPCLoader: live metadata could not map fencepost to wrapper for {}::{}",
                             iface.name, methodSeed.name);
                    return false;
                }

                ResolvedMethod resolved;
                resolved.method.interfaceID = iface.id;
                resolved.method.name = methodSeed.name;
                resolved.method.funcHash = methodSeed.funcHash;
                resolved.method.fencepost = methodSeed.fencepost;
                resolved.method.argc = methodSeed.argc;
                resolved.wrapperRva = runtimeFn->beginRva;
                resolvedMethods.push_back(std::move(resolved));
            }

            struct CandidateHit {
                uint32_t candidateStartRva = 0;
                std::set<std::string> pivots;
            };

            std::map<uint32_t, CandidateHit> candidateHits;
            for (const auto& resolved : resolvedMethods) {
                const uint64_t wrapperVa = peOpt->imageBase + resolved.wrapperRva;
                const auto wrapperBytes = ToLeBytes<uint64_t>(wrapperVa);
                const auto refs = FindAllRawMatches(
                    *bytesOpt,
                    std::span<const uint8_t>(wrapperBytes),
                    peOpt->sections,
                    false,
                    true);

                for (const auto refOffset : refs) {
                    const auto refRva = FileOffsetToRva(*peOpt, refOffset);
                    if (!refRva) continue;

                    const auto seedIt = std::find_if(
                        ifaceSeed.methods.begin(),
                        ifaceSeed.methods.end(),
                        [&](const IpcMethodSeed& item) { return resolved.method.name == item.name; });
                    if (seedIt == ifaceSeed.methods.end()) continue;
                    if (*refRva < seedIt->methodIndex * 8) continue;

                    const uint32_t candidateStartRva = *refRva - seedIt->methodIndex * 8;
                    auto& hit = candidateHits[candidateStartRva];
                    hit.candidateStartRva = candidateStartRva;
                    hit.pivots.insert(resolved.method.name);
                }
            }

            const size_t minPivotCount = candidateHits.size() >= 2 ? 2 : 1;
            bool foundVtable = false;
            for (const auto& [candidateRva, hit] : candidateHits) {
                if (hit.pivots.size() < minPivotCount) continue;

                bool ok = true;
                for (const auto& seed : ifaceSeed.methods) {
                    const auto slotOffset = RvaToFileOffset(*peOpt, candidateRva + seed.methodIndex * 8);
                    if (!slotOffset || *slotOffset + 8 > bytesOpt->size()) {
                        ok = false;
                        break;
                    }

                    const uint64_t slotVa = *reinterpret_cast<const uint64_t*>(bytesOpt->data() + *slotOffset);
                    if (slotVa < peOpt->imageBase) {
                        ok = false;
                        break;
                    }

                    const auto slotRva = static_cast<uint32_t>(slotVa - peOpt->imageBase);
                    if (!IsExecutableRva(*peOpt, slotRva)) {
                        ok = false;
                        break;
                    }
                }

                if (ok) {
                    iface.vtableRva = candidateRva;
                    foundVtable = true;
                    break;
                }
            }

            if (!foundVtable) {
                LOG_WARN("IPCLoader: live metadata could not resolve vtable for {}", iface.name);
                return false;
            }

            for (const auto& resolved : resolvedMethods) {
                iface.methods.push_back(resolved.method);
            }

            generated.Add(std::move(iface));
        }

        LOG_INFO("IPCLoader: generated {} methods across {} interfaces directly from steamclient",
                 generated.MethodCount(), generated.interfaces.size());
        g_registry = std::move(generated);
        return true;
    }

    void ShowGenerationFailedPopup(const std::string& steamclientPath)
    {
        const auto dllName = std::filesystem::path(steamclientPath).filename().string();
        SteamDiagnostics::ShowWarning(
            "OpenSteamTool - IPC metadata unavailable",
            "OpenSteamTool: could not derive live IPC metadata from " + dllName + ".\n\n"
            "IPC interception is disabled for this session; pattern-based hooks are unaffected.\n\n"
            "Please report the diagnostics below at:\n"
            "https://github.com/OpenSteam001/OpenSteamTool/issues");
    }

} // namespace

bool Load(const std::string& steamclientPath)
{
    g_registry.Clear();

    if (BuildRegistryFromLiveSteamclient(steamclientPath)) {
        return true;
    }

    ShowGenerationFailedPopup(steamclientPath);
    return false;
}

const Method* Find(EIPCInterface interfaceID, uint32_t funcHash)
{
    return g_registry.Find(interfaceID, funcHash);
}

const Method* Find(std::string_view ifaceName, std::string_view methodName)
{
    return g_registry.Find(ifaceName, methodName);
}

size_t InterfaceCount()
{
    return g_registry.interfaces.size();
}

size_t MethodCount()
{
    return g_registry.MethodCount();
}

} // namespace IPCLoader

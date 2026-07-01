#include "PatternLoader.h"
#include "OSTPlatform/include/Memory.h"
#include "Utils/Logging/Log.h"
#include "Utils/SteamMetadata/SteamDiagnostics.h"
#include "Utils/Support/FnvHash.h"

#include <windows.h>

#include <algorithm>
#include <array>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <optional>
#include <set>
#include <span>
#include <sstream>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

// ---- compile-time sanity checks for FNV-1a table keys ----
static_assert(Fnv1aHash("BBuildAndAsyncSendFrame") == 0x82428E37u,
              "FNV-1a mismatch for BBuildAndAsyncSendFrame");
static_assert(Fnv1aHash("BuildDepotDependency") == 0xC37F2D8Eu,
              "FNV-1a mismatch for BuildDepotDependency");

namespace {

struct PatternSeed {
    const char* id;
    const char* name;
    const char* seedSig;
    uint32_t preferredRva = 0;
};

struct PatternEntry {
    std::string name;
    uintptr_t rva = 0;
    std::string sig;
};

using PatternMap = std::unordered_map<uint32_t, PatternEntry>;

constexpr PatternSeed kSteamclientPatternSeeds[] = {
    {"0x82428E37","BBuildAndAsyncSendFrame","48 8B C4 55 48 8D 68 A1 48 81 EC C0 00 00 00 48 89 70 18"},
    {"0xC37F2D8E","BuildDepotDependency","48 8B C4 4C 89 48 20 89 50 10 48 89 48 08 55 57"},
    {"0xDB78B4AE","BuildSpawnEnvBlock","4C 89 4C 24 20 4C 89 44 24 18 48 89 54 24 10 48 89 4C 24 08 55 53 56 57 41 54 41 55 41 56 41 57 48 8D AC 24 B8 FE FF FF"},
    {"0x64BF7C45","CUtlBufferEnsureCapacity","48 89 5C 24 08 57 48 83 EC 30 48 8B D9 8D 7A 01"},
    {"0x2D945919","CUtlMemoryGrow","48 89 5C 24 10 57 48 83 EC 30 8B FA 48 8B D9 8B 51 08 8B 49 10 8D 04 39",0xE8280},
    {"0x4B1B1D77","CheckAppOwnership","48 8B C4 89 50 10 48 89 48 08 55 53"},
    {"0x04691B23","CloseAppCloud","48 89 5C 24 10 57 48 83 EC 30 8B FA 48 8B D9 85 D2"},
    {"0x6179E8F9","ConfigStoreGetBinary","40 53 55 56 57 48 83 EC 38 48 63 FA 49 8B E9"},
    {"0xAC76B47D","GetAppDataFromAppInfo","40 53 55 56 57 41 56 41 57 48 81 EC 78 01 00 00"},
    {"0xA185DB47","GetAppIDForCurrentPipe","8B 81 30 0D 00 00 83 F8 FF 74 ??"},
    {"0xCC79542C","GetOrAddAppData","48 83 EC 58 48 8B 05 ?? ?? ?? ?? 48 89 5C 24 68 48 89 6C 24 70"},
    {"0x3B3A0F9D","GetPackageInfo","48 89 5C 24 18 89 54 24 10 55 56 57 48 83 EC 20 44 8B 49 20"},
    {"0x02DF23BC","GetPipeClient","85 D2 74 ?? 44 0F B7 CA 44 3B 49 60"},
    {"0xC3E20E29","IPCProcessMessage","48 89 5C 24 18 48 89 6C 24 20 57 41 54 41 55 41 56 41 57 48 83 EC 30"},
    {"0xED5ED0C8","KeyValues_FindOrCreateKey","48 8B C4 57 48 81 EC 50 04 00 00"},
    {"0x2434A8BA","KeyValues_ReadAsBinary","48 8B C4 44 88 48 20 55 48 8D 68 A9"},
    {"0xB13C0C3F","LoadDepotDecryptionKey","40 53 55 56 57 48 83 EC 38 48 63 FA 49 8B E9"},
    {"0x31E49927","LoadPackage","44 89 44 24 18 53 55 56 57 41 55"},
    {"0xC451039D","MarkLicenseAsChanged","48 89 5C 24 20 89 54 24 10 55 56 57 48 83 EC 20"},
    {"0x06631030","OptedInMask","89 54 24 10 55 53 56 57 41 54 41 55 48 8D AC 24 38 FF FF FF"},
    {"0x0F926D0A","PchMsgNameFromEMsg","48 89 5C 24 08 57 48 83 EC 20 8B D9 E8 ?? ?? ?? ??"},
    {"0x103B52AA","ProcessPendingLicenseUpdates","41 56 41 57 48 83 EC 38 83 B9 98 24 00 00 00"},
    {"0x836FF9F0","RecvPkt","48 8B C4 55 48 8D A8 98 F6 FF FF"},
    {"0x68211B4D","SendCallbackToPipe","48 89 5C 24 08 57 48 83 EC 30 41 8B D9 41 8B F8"},
    {"0x7D1EC415","SpawnProcess","48 89 5C 24 18 4C 89 4C 24 20 48 89 54 24 10 55 56 57 41 54 41 55 41 56 41 57 48 8D AC 24 30 FF FF FF"},
};

constexpr PatternSeed kSteamuiPatternSeeds[] = {
    {"0xD05E26A2","AddProtobufAsBinary","40 53 55 56 57 48 83 EC 28 48 8B 05 ?? ?? ?? ?? 48 8B F2"},
    {"0xE22F74B4","BuildCompleteAppOverviewChange","4C 89 44 24 18 48 89 54 24 10 48 89 4C 24 08 55 53 56 57 41 54 41 55 41 56 41 57 48 8D 6C 24 E1"},
    {"0x221F0661","CSteamUIAppControllerRunFrame","48 89 5C 24 10 48 89 6C 24 18 56 57 41 54 41 56 41 57 48 83 EC 40 0F 29 74 24 30"},
    {"0xB030A061","FillInAppOverview","48 89 54 24 10 48 89 4C 24 08 55 53 56 57 41 54 41 55 41 56 41 57 48 8D 6C 24 E1 48 81 EC B8 00 00 00"},
    {"0x3FC68546","GetAppByID","89 54 24 10 53 48 83 EC 40 48 8B 05 ?? ?? ?? ??"},
    {"0xC89CFA75","GetTopManager","48 8B 05 19 20 B0 00 C3",0x5FEEF0},
    {"0xBDE16BD6","LoadModuleWithPath","48 89 5C 24 18 55 56 41 57 48 83 EC 40"},
    {"0xC7D5CACF","MarkAppChange","48 83 EC 78 48 8B 05 ?? ?? ?? ?? 48 89 74 24 70"},
    {"0x153479F0","RepeatedFieldUint32_Add","48 89 74 24 10 48 89 7C 24 18 41 56 48 83 EC 20 8B 31 48 8B F9 8B 49 04",0x6C3EF0},
    {"0xD055D6C0","ShouldShowAppInLibrary","40 53 48 83 EC 20 48 8B 01 48 8B D9 FF 10 3D D6 0C 09 00"},
};

struct SectionInfo {
    uint32_t virtualAddress = 0;
    uint32_t virtualSize = 0;
    uint32_t rawOffset = 0;
    uint32_t rawSize = 0;
};

struct PortableExecutable {
    uint64_t imageBase = 0;
    std::vector<SectionInfo> sections;
};

static std::unordered_map<OSTPlatform::DynamicLibrary::ModuleHandle, PatternMap> g_moduleMaps;
static std::unordered_set<OSTPlatform::DynamicLibrary::ModuleHandle> g_failedModules;
static std::vector<std::string> g_missingFunctions;

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

    const auto* section = IMAGE_FIRST_SECTION(nt);
    for (unsigned i = 0; i < nt->FileHeader.NumberOfSections; ++i, ++section) {
        SectionInfo info;
        info.virtualAddress = section->VirtualAddress;
        info.virtualSize = section->Misc.VirtualSize;
        info.rawOffset = section->PointerToRawData;
        info.rawSize = section->SizeOfRawData;
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

bool ParseSig(const std::string& str,
              std::vector<uint8_t>& bytes,
              std::vector<uint8_t>& mask)
{
    bytes.clear();
    mask.clear();
    for (const char* p = str.c_str(); *p; ) {
        if (*p == ' ' || *p == '\t' || *p == ',') {
            ++p;
            continue;
        }
        if (p[0] == '?' && p[1] == '?') {
            bytes.push_back(0);
            mask.push_back(0);
            p += 2;
            continue;
        }
        const char hi = p[0];
        const char lo = p[1];
        if (!hi || !lo) return false;

        auto nib = [](char c) -> int {
            if (c >= '0' && c <= '9') return c - '0';
            if (c >= 'a' && c <= 'f') return c - 'a' + 10;
            if (c >= 'A' && c <= 'F') return c - 'A' + 10;
            return -1;
        };

        const int h = nib(hi);
        const int l = nib(lo);
        if (h < 0 || l < 0) return false;

        bytes.push_back(static_cast<uint8_t>((h << 4) | l));
        mask.push_back(1);
        p += 2;
    }
    return !bytes.empty();
}

void* ScanModule(OSTPlatform::DynamicLibrary::ModuleHandle module,
                 const std::vector<uint8_t>& bytes,
                 const std::vector<uint8_t>& mask)
{
    const auto image = OSTPlatform::Memory::GetModuleImage(module);
    if (!image) return nullptr;

    auto* base = image->base;
    const size_t size = image->size;
    const size_t patLen = bytes.size();
    if (size < patLen) return nullptr;

    for (size_t i = 0; i <= size - patLen; ++i) {
        bool found = true;
        for (size_t j = 0; j < patLen; ++j) {
            if (mask[j] && base[i + j] != bytes[j]) {
                found = false;
                break;
            }
        }
        if (found) return base + i;
    }

    return nullptr;
}

std::vector<int> ParseSignatureTokens(std::string_view sig)
{
    std::vector<int> out;
    std::string token;
    std::istringstream iss{std::string(sig)};
    while (iss >> token) {
        if (token == "??") {
            out.push_back(-1);
        } else {
            out.push_back(static_cast<int>(std::strtoul(token.c_str(), nullptr, 16)));
        }
    }
    return out;
}

std::vector<uint32_t> FindAllMatches(const std::vector<uint8_t>& buffer, const std::vector<int>& tokens)
{
    std::vector<uint32_t> matches;
    if (tokens.empty() || buffer.size() < tokens.size()) return matches;

    for (size_t offset = 0; offset + tokens.size() <= buffer.size(); ++offset) {
        bool ok = true;
        for (size_t i = 0; i < tokens.size(); ++i) {
            if (tokens[i] >= 0 && buffer[offset + i] != static_cast<uint8_t>(tokens[i])) {
                ok = false;
                break;
            }
        }
        if (ok) matches.push_back(static_cast<uint32_t>(offset));
    }

    return matches;
}

std::vector<int> WildcardIndexesFromSeed(std::string_view seedSig)
{
    std::vector<int> out;
    std::string token;
    std::istringstream iss{std::string(seedSig)};
    int index = 0;
    while (iss >> token) {
        if (token == "??") out.push_back(index);
        ++index;
    }
    return out;
}

std::vector<int> DeriveWildcardsFromLiveBytes(const std::vector<uint8_t>& bytes)
{
    std::set<int> wildcards;
    for (size_t i = 0; i + 4 < bytes.size(); ++i) {
        const auto opcode = bytes[i];
        if (opcode == 0xE8 || opcode == 0xE9) {
            for (int j = 1; j <= 4; ++j) wildcards.insert(static_cast<int>(i + j));
            continue;
        }

        if ((opcode == 0x48 || opcode == 0x4C) && i + 6 < bytes.size()) {
            const auto opcode2 = bytes[i + 1];
            const auto opcode3 = bytes[i + 2];
            if ((opcode2 == 0x8B || opcode2 == 0x8D || opcode2 == 0x89 || opcode2 == 0x39) &&
                opcode3 >= 0x05 && opcode3 <= 0x3D && ((opcode3 - 0x05) % 8 == 0)) {
                for (int j = 3; j <= 6; ++j) wildcards.insert(static_cast<int>(i + j));
            }
        }
    }
    return std::vector<int>(wildcards.begin(), wildcards.end());
}

std::vector<int> MergeWildcards(std::vector<int> a, std::vector<int> b, size_t length)
{
    std::set<int> merged;
    for (const int value : a) {
        if (value >= 0 && static_cast<size_t>(value) < length) merged.insert(value);
    }
    for (const int value : b) {
        if (value >= 0 && static_cast<size_t>(value) < length) merged.insert(value);
    }
    return std::vector<int>(merged.begin(), merged.end());
}

std::string BytesToSignature(const std::vector<uint8_t>& bytes, const std::vector<int>& wildcards)
{
    std::set<int> wildcardSet(wildcards.begin(), wildcards.end());
    std::ostringstream oss;
    for (size_t i = 0; i < bytes.size(); ++i) {
        if (i) oss << ' ';
        if (wildcardSet.count(static_cast<int>(i))) {
            oss << "??";
        } else {
            oss << std::uppercase << std::hex;
            oss.width(2);
            oss.fill('0');
            oss << static_cast<int>(bytes[i]);
        }
    }
    return oss.str();
}

std::optional<PatternEntry> BuildAutoPatternEntry(const PortableExecutable& pe,
                                                  const std::vector<uint8_t>& buffer,
                                                  const PatternSeed& seed,
                                                  uint32_t seedMatchOffset)
{
    const auto minLength = ParseSignatureTokens(seed.seedSig).size();
    const auto maxLength = (std::min<size_t>)(128, buffer.size() - seedMatchOffset);
    size_t length = minLength;

    while (length <= maxLength) {
        std::vector<uint8_t> liveBytes(buffer.begin() + seedMatchOffset, buffer.begin() + seedMatchOffset + length);
        auto wildcards = MergeWildcards(
            WildcardIndexesFromSeed(seed.seedSig),
            DeriveWildcardsFromLiveBytes(liveBytes),
            length);
        const auto sig = BytesToSignature(liveBytes, wildcards);
        const auto matches = FindAllMatches(buffer, ParseSignatureTokens(sig));
        if (matches.size() == 1 && matches[0] == seedMatchOffset) {
            const auto rva = FileOffsetToRva(pe, seedMatchOffset);
            if (!rva) return std::nullopt;

            PatternEntry entry;
            entry.name = seed.name;
            entry.rva = *rva;
            entry.sig = sig;
            return entry;
        }
        length += 8;
    }

    return std::nullopt;
}

std::optional<PatternMap> GeneratePatterns(const std::string& dllPath, std::span<const PatternSeed> seeds)
{
    const auto bytesOpt = ReadFileBytes(dllPath);
    if (!bytesOpt) return std::nullopt;

    const auto peOpt = ParsePe64(*bytesOpt);
    if (!peOpt) return std::nullopt;

    PatternMap map;
    map.reserve(seeds.size());

    for (const auto& seed : seeds) {
        auto matches = FindAllMatches(*bytesOpt, ParseSignatureTokens(seed.seedSig));
        if (matches.size() != 1 && seed.preferredRva != 0) {
            std::vector<uint32_t> filtered;
            for (const auto offset : matches) {
                const auto rva = FileOffsetToRva(*peOpt, offset);
                if (rva && *rva == seed.preferredRva) {
                    filtered.push_back(offset);
                }
            }
            matches = std::move(filtered);
        }

        if (matches.size() != 1) {
            LOG_WARN("PatternLoader: failed to resolve live seed {} in {}", seed.name, dllPath);
            return std::nullopt;
        }

        const auto entry = BuildAutoPatternEntry(*peOpt, *bytesOpt, seed, matches[0]);
        if (!entry) {
            LOG_WARN("PatternLoader: failed to derive stable live signature for {} in {}", seed.name, dllPath);
            return std::nullopt;
        }

        map[Fnv1aHash(seed.name)] = *entry;
    }

    return map;
}

void ShowGenerationFailedPopup(const std::string& dllName)
{
    SteamDiagnostics::ShowWarning(
        "OpenSteamTool - Unsupported Steam Version",
        "OpenSteamTool: could not derive live signatures for " + dllName + ".\n\n"
        "Hooks that depend on this module are disabled for this session; other modules are unaffected.\n\n"
        "Please report the diagnostics below at:\n"
        "https://github.com/OpenSteam001/OpenSteamTool/issues");
}

std::span<const PatternSeed> GetSeedsForComponent(const std::string& component)
{
    if (component == "steamclient") {
        return std::span<const PatternSeed>(kSteamclientPatternSeeds);
    }
    if (component == "steamui") {
        return std::span<const PatternSeed>(kSteamuiPatternSeeds);
    }
    return {};
}

} // namespace

namespace PatternLoader {

bool Load(OSTPlatform::DynamicLibrary::ModuleHandle module, const std::string& dllPath, const std::string& component)
{
    const auto seeds = GetSeedsForComponent(component);
    if (seeds.empty()) {
        LOG_WARN("PatternLoader: no live seed set for component {}", component);
        g_failedModules.insert(module);
        return false;
    }

    const auto map = GeneratePatterns(dllPath, seeds);
    if (!map) {
        ShowGenerationFailedPopup(std::filesystem::path(dllPath).filename().string());
        g_failedModules.insert(module);
        return false;
    }

    LOG_INFO("PatternLoader: generated {} live patterns for {}", map->size(), component);
    g_failedModules.erase(module);
    g_moduleMaps[module] = *map;
    return true;
}

void* FindPattern(OSTPlatform::DynamicLibrary::ModuleHandle module, const char* funcName)
{
    if (g_failedModules.count(module)) {
        return nullptr;
    }

    const uint32_t key = Fnv1aHash(funcName);
    const auto mapIt = g_moduleMaps.find(module);
    if (mapIt == g_moduleMaps.end()) {
        LOG_WARN("PatternLoader: FindPattern called for module that was never loaded ('{}')", funcName);
        g_missingFunctions.emplace_back(funcName);
        return nullptr;
    }

    const auto& map = mapIt->second;
    const auto entryIt = map.find(key);
    if (entryIt == map.end()) {
        LOG_WARN("PatternLoader: no entry for '{}' (key=0x{:08X})", funcName, key);
        g_missingFunctions.emplace_back(funcName);
        return nullptr;
    }

    const PatternEntry& entry = entryIt->second;
    if (entry.rva != 0) {
        void* addr = reinterpret_cast<void*>(reinterpret_cast<uintptr_t>(module) + entry.rva);
        LOG_DEBUG("PatternLoader: {} resolved via RVA 0x{:X}", funcName, entry.rva);
        return addr;
    }

    if (!entry.sig.empty()) {
        std::vector<uint8_t> bytes;
        std::vector<uint8_t> mask;
        if (ParseSig(entry.sig, bytes, mask)) {
            void* addr = ScanModule(module, bytes, mask);
            if (addr) {
                const uintptr_t rva = reinterpret_cast<uintptr_t>(addr) - reinterpret_cast<uintptr_t>(module);
                LOG_DEBUG("PatternLoader: {} resolved via sig @ RVA 0x{:X}", funcName, rva);
                return addr;
            }
            LOG_WARN("PatternLoader: sig scan miss for '{}' (pattern parsed OK, no match in module image)", funcName);
        } else {
            LOG_WARN("PatternLoader: malformed sig for '{}': '{}'", funcName, entry.sig);
        }
    } else {
        LOG_WARN("PatternLoader: entry for '{}' has neither rva nor sig", funcName);
    }

    g_missingFunctions.emplace_back(funcName);
    return nullptr;
}

void ReportMissingFunctions()
{
    if (g_missingFunctions.empty()) return;

    std::string list;
    for (const auto& name : g_missingFunctions) {
        list += "  - " + name + "\n";
    }
    g_missingFunctions.clear();

    SteamDiagnostics::ShowWarning(
        "OpenSteamTool - Missing Signatures",
        "OpenSteamTool: some functions could not be located.\n\n"
        "The following functions were not resolved from live metadata:\n" +
        list +
        "\nHooks for these functions are disabled for this session.\n\n"
        "Please report this at:\n"
        "https://github.com/OpenSteam001/OpenSteamTool/issues");
}

} // namespace PatternLoader

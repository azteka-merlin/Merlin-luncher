#pragma once

#include <cstdint>

namespace MerlinHelperApi {

enum GenerateFlags : uint32_t {
    GeneratePatternSteamclient = 1u << 0,
    GeneratePatternSteamui     = 1u << 1,
    GenerateIpcSteamclient     = 1u << 2,
    GenerateAll                = GeneratePatternSteamclient | GeneratePatternSteamui | GenerateIpcSteamclient
};

struct GenerateRequest {
    uint32_t structSize = sizeof(GenerateRequest);
    uint32_t flags = GenerateAll;
    const char* steamRoot = nullptr;
    const char* steamclientPath = nullptr;
    const char* steamuiPath = nullptr;
};

struct GenerateResult {
    uint32_t structSize = sizeof(GenerateResult);
    uint32_t generatedMask = 0;
    uint32_t failedMask = 0;
};

using GenerateMetadataFn = uint32_t (*)(const GenerateRequest* request, GenerateResult* result);

constexpr const char* kExportName = "MerlinGenerateOpenSteamToolMetadata";

} // namespace MerlinHelperApi


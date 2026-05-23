#pragma once
#include "Steam/Types.h"

namespace Hooks_Manifest {
    void Install();
    void Uninstall();

    // Fetch a manifest request code from online providers.
    // Thread-safe — serialises access to the underlying WinHTTP connection.
    // Returns true and sets *outRequestCode on success.
    // AppId and DepotId are optional; when provided, enables fetch_manifest_code_ex.
    bool FetchManifestRequestCode(uint64_t manifestGid, uint64_t* outRequestCode,
                                AppId_t AppId = 0, AppId_t DepotId = 0);
}

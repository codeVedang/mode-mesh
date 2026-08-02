param(
    [string]$SecretFile = "deployment-secrets.local.env"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$secretPath = Join-Path $projectRoot $SecretFile

if (-not (Test-Path -LiteralPath $secretPath)) {
    throw "Secret input file not found: $secretPath"
}

$values = @{}
foreach ($line in Get-Content -LiteralPath $secretPath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
        continue
    }

    $separator = $line.IndexOf("=")
    if ($separator -lt 1) {
        throw "Invalid non-comment line in the secret input file."
    }

    $key = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim()

    if ($value.Length -ge 2) {
        $doubleQuoted = $value.StartsWith('"') -and $value.EndsWith('"')
        $singleQuoted = $value.StartsWith("'") -and $value.EndsWith("'")
        if ($doubleQuoted -or $singleQuoted) {
            $value = $value.Substring(1, $value.Length - 2)
        }
    }

    $values[$key] = $value
}

function Get-ConfiguredValue {
    param(
        [string]$Name,
        [string]$Default = ""
    )

    if ($values.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace($values[$Name])) {
        return $values[$Name]
    }

    return $Default
}

function Write-EnvironmentFile {
    param(
        [string]$RelativePath,
        [System.Collections.Specialized.OrderedDictionary]$Entries
    )

    $targetPath = Join-Path $projectRoot $RelativePath
    $lines = foreach ($entry in $Entries.GetEnumerator()) {
        "$($entry.Key)=$($entry.Value)"
    }

    $content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($targetPath, $content, $encoding)
    Write-Output "UPDATED $RelativePath"
}

$mongo = Get-ConfiguredValue "MONGODB_URI"
$redis = Get-ConfiguredValue "REDIS_URL"
$authService = Get-ConfiguredValue "AUTH_SERVICE" "http://localhost:8001"
$chatService = Get-ConfiguredValue "CHAT_SERVICE" "http://localhost:8002"
$agentService = Get-ConfiguredValue "AGENT_SERVICE" "http://localhost:8003"
$billingService = Get-ConfiguredValue "BILLING_SERVICE" "http://localhost:8004"
$frontendUrl = Get-ConfiguredValue "FRONTEND_URL" "http://localhost:5173"
$serverUrl = Get-ConfiguredValue "VITE_SERVER_URL" "http://localhost:8000"

Write-EnvironmentFile "frontend/.env" ([ordered]@{
    VITE_FIREBASE_API_KEY = Get-ConfiguredValue "VITE_FIREBASE_API_KEY"
    VITE_RAZORPAY_KEY_ID  = Get-ConfiguredValue "RAZORPAY_KEY_ID"
    VITE_SERVER_URL       = $serverUrl
})

Write-EnvironmentFile "backend/gateway/.env" ([ordered]@{
    PORT            = "8000"
    AUTH_SERVICE    = $authService
    CHAT_SERVICE    = $chatService
    AGENT_SERVICE   = $agentService
    BILLING_SERVICE = $billingService
    FRONTEND_URL    = $frontendUrl
    REDIS_URL       = $redis
})

Write-EnvironmentFile "backend/services/auth/.env" ([ordered]@{
    PORT                          = "8001"
    MONGODB_URI                   = $mongo
    REDIS_URL                     = $redis
    FIREBASE_SERVICE_ACCOUNT_JSON = Get-ConfiguredValue "FIREBASE_SERVICE_ACCOUNT_JSON"
})

Write-EnvironmentFile "backend/services/chat/.env" ([ordered]@{
    PORT        = "8002"
    MONGODB_URI = $mongo
})

Write-EnvironmentFile "backend/services/agent/.env" ([ordered]@{
    PORT                  = "8003"
    MONGODB_URI           = $mongo
    GROQ_API_KEY          = Get-ConfiguredValue "GROQ_API_KEY"
    GOOGLE_API_KEY        = Get-ConfiguredValue "GOOGLE_API_KEY"
    CHAT_SERVICE          = $chatService
    AUTH_SERVICE          = $authService
    REDIS_URL             = $redis
    TAVILY_API_KEY        = Get-ConfiguredValue "TAVILY_API_KEY"
    OPENROUTER_API_KEY    = Get-ConfiguredValue "OPENROUTER_API_KEY"
    AWS_REGION            = Get-ConfiguredValue "AWS_REGION"
    AWS_ACCESS_KEY_ID     = Get-ConfiguredValue "AWS_ACCESS_KEY_ID"
    AWS_SECRET_KEY        = Get-ConfiguredValue "AWS_SECRET_KEY"
    AWS_BUCKET_NAME       = Get-ConfiguredValue "AWS_BUCKET_NAME"
    QDRANT_API_KEY        = Get-ConfiguredValue "QDRANT_API_KEY"
    QDRANT_URL            = Get-ConfiguredValue "QDRANT_URL"
})

Write-EnvironmentFile "backend/services/billing/.env" ([ordered]@{
    PORT                = "8004"
    MONGODB_URI         = $mongo
    AUTH_SERVICE        = $authService
    RAZORPAY_KEY_ID     = Get-ConfiguredValue "RAZORPAY_KEY_ID"
    RAZORPAY_KEY_SECRET = Get-ConfiguredValue "RAZORPAY_KEY_SECRET"
})

$firebaseJson = Get-ConfiguredValue "FIREBASE_SERVICE_ACCOUNT_JSON"
if ($firebaseJson) {
    $null = $firebaseJson | ConvertFrom-Json -ErrorAction Stop
    $firebasePath = Join-Path $projectRoot "backend/services/auth/serviceAccountKey.json"
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($firebasePath, $firebaseJson, $encoding)
    Write-Output "UPDATED backend/services/auth/serviceAccountKey.json"
} else {
    Write-Output "SKIPPED backend/services/auth/serviceAccountKey.json (FIREBASE_SERVICE_ACCOUNT_JSON is missing)"
}

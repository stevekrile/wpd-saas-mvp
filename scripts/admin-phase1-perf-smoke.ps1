param(
    [string]$BaseUrl = "https://localhost:7193",
    [int]$Iterations = 20
)

if ($Iterations -lt 1) {
    throw "Iterations must be at least 1."
}

$endpoints = @(
    "/api/public/lenses",
    "/api/public/content/landing"
)

Write-Host "Running admin phase 1 baseline smoke against $BaseUrl"
Write-Host "Iterations per endpoint: $Iterations"

foreach ($endpoint in $endpoints) {
    $durations = @()
    $url = "$BaseUrl$endpoint"
    for ($i = 0; $i -lt $Iterations; $i++) {
        $output = curl.exe -k -s -o NUL -w "%{time_total} %{http_code}" $url
        $parts = $output.Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)

        if ($parts.Length -ne 2) {
            throw "Unexpected curl output for ${endpoint}: '$output'"
        }

        $seconds = [double]$parts[0]
        $statusCode = [int]$parts[1]
        if ($statusCode -lt 200 -or $statusCode -ge 300) {
            throw "Request failed for $endpoint with status code $statusCode."
        }

        $durations += ($seconds * 1000.0)
    }

    $sorted = $durations | Sort-Object
    $avg = ($durations | Measure-Object -Average).Average
    $p95Index = [Math]::Max([Math]::Ceiling($Iterations * 0.95) - 1, 0)
    $p95 = $sorted[$p95Index]
    $min = ($durations | Measure-Object -Minimum).Minimum
    $max = ($durations | Measure-Object -Maximum).Maximum

    Write-Host ""
    Write-Host "Endpoint: $endpoint"
    Write-Host ("  Avg(ms): {0:N2}" -f $avg)
    Write-Host ("  P95(ms): {0:N2}" -f $p95)
    Write-Host ("  Min(ms): {0:N2}" -f $min)
    Write-Host ("  Max(ms): {0:N2}" -f $max)
}

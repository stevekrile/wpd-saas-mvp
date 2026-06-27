param(
    [string]$BaseUrl = "https://localhost:7193",
    [int]$Iterations = 20
)

if ($Iterations -lt 1) {
    throw "Iterations must be at least 1."
}

$endpoints = @(
    @{ Method = "GET";  Path = "/api/admin/users" },
    @{ Method = "GET";  Path = "/api/admin/usage/summary?fromUtc=2026-06-27T00:00:00Z&toUtc=2026-06-27T01:00:00Z" },
    @{ Method = "GET";  Path = "/api/admin/usage/users/user_unauth?fromUtc=2026-06-27T00:00:00Z&toUtc=2026-06-27T01:00:00Z" },
    @{ Method = "GET";  Path = "/api/admin/usage/ai-tokens?fromUtc=2026-06-27T00:00:00Z&toUtc=2026-06-27T01:00:00Z" },
    @{ Method = "POST"; Path = "/api/admin/record-access/query"; Body = '{"recordType":"process","recordId":"1","reason":"perf smoke"}' },
    @{ Method = "GET";  Path = "/api/admin/record-access/history?fromUtc=2026-06-27T00:00:00Z&toUtc=2026-06-27T01:00:00Z" },
    @{ Method = "POST"; Path = "/api/admin/users/user_unauth/deactivate"; Body = '{"reason":"perf smoke"}' },
    @{ Method = "POST"; Path = "/api/admin/users/user_unauth/reactivate"; Body = '{"reason":"perf smoke"}' },
    @{ Method = "POST"; Path = "/api/admin/accounts/1/deactivate"; Body = '{"reason":"perf smoke"}' },
    @{ Method = "POST"; Path = "/api/admin/accounts/1/reactivate"; Body = '{"reason":"perf smoke"}' }
)

Write-Host "Running admin phase 1 admin-route smoke against $BaseUrl"
Write-Host "Iterations per endpoint: $Iterations"

foreach ($endpoint in $endpoints) {
    $durations = @()
    $url = "$BaseUrl$($endpoint.Path)"
    $label = "$($endpoint.Method) $($endpoint.Path)"

    for ($i = 0; $i -lt $Iterations; $i++) {
        if ($endpoint.Method -eq "POST") {
            $output = curl.exe -k -s -X POST -H "Content-Type: application/json" -d $endpoint.Body -o NUL -w "%{time_total} %{http_code}" $url
        } else {
            $output = curl.exe -k -s -X GET -o NUL -w "%{time_total} %{http_code}" $url
        }

        $parts = $output.Split(' ', [System.StringSplitOptions]::RemoveEmptyEntries)
        if ($parts.Length -ne 2) {
            throw "Unexpected curl output for ${label}: '$output'"
        }

        $seconds = [double]$parts[0]
        $statusCode = [int]$parts[1]
        if ($statusCode -lt 200 -or $statusCode -ge 500) {
            throw "Request failed for $label with status code $statusCode."
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
    Write-Host "Endpoint: $label"
    Write-Host ("  Avg(ms): {0:N2}" -f $avg)
    Write-Host ("  P95(ms): {0:N2}" -f $p95)
    Write-Host ("  Min(ms): {0:N2}" -f $min)
    Write-Host ("  Max(ms): {0:N2}" -f $max)
}

namespace Wpd.Api.DTOs.Agency;

public class AgencyProfileResponse
{
    public string UserId { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
    public List<AgencyLensResponse> Lenses { get; set; } = new();
}

public class AgencyLensResponse
{
    public string LensKey { get; set; } = string.Empty;
    public string LensName { get; set; } = string.Empty;
    public decimal? AgencyScore { get; set; }
    public int AnsweredStatements { get; set; }
    public int TotalStatements { get; set; }
    public List<AgencyStatementResponse> Statements { get; set; } = new();
}

public class AgencyStatementResponse
{
    public int StatementNumber { get; set; }
    public string StatementText { get; set; } = string.Empty;
    public int? Score { get; set; }
}

public class SaveAgencyStatementScoreRequest
{
    public int Score { get; set; }
}

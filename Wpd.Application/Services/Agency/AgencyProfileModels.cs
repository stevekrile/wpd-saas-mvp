namespace Wpd.Application.Services.Agency;

public class AgencyProfileModel
{
    public string UserId { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
    public List<AgencyLensModel> Lenses { get; set; } = new();
}

public class AgencyLensModel
{
    public string LensKey { get; set; } = string.Empty;
    public string LensName { get; set; } = string.Empty;
    public decimal? AgencyScore { get; set; }
    public int AnsweredStatements { get; set; }
    public int TotalStatements { get; set; }
    public List<AgencyStatementModel> Statements { get; set; } = new();
}

public class AgencyStatementModel
{
    public int StatementNumber { get; set; }
    public string StatementText { get; set; } = string.Empty;
    public int? Score { get; set; }
}

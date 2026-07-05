namespace Wpd.Application.Services.Agency;

public interface IAgencyProfileService
{
    Task<AgencyProfileModel?> GetProfileAsync(string userId);
    Task<(bool Succeeded, AgencyProfileModel? Profile, string Error)> SaveStatementScoreAsync(
        string userId,
        string lensKey,
        int statementNumber,
        int score);
}

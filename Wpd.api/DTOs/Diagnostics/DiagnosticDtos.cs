namespace Wpd.Api.DTOs.Diagnostics;

public class DiagnosticStartResponse
{
    public int DiagnosticId { get; set; }
    public int ProcessId { get; set; }
    public string ProcessName { get; set; } = string.Empty;
    public string ProcessDescription { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public List<DiagnosticLensResponse> Lenses { get; set; } = new();
}

public class DiagnosticLensResponse
{
    public int LensId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public string PublicDescription { get; set; } = string.Empty;
    public List<DiagnosticQuestionResponse> Questions { get; set; } = new();
}

public class DiagnosticQuestionResponse
{
    public int Id { get; set; }
    public int LensId { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string HelpText { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsRequired { get; set; }
    public bool IsActive { get; set; }
    public bool FreeTierVisible { get; set; }
    public decimal Weight { get; set; }
    public int? NumericResponse { get; set; }
    public string TextResponse { get; set; } = string.Empty;
    public DateTime? AnsweredAt { get; set; }
}

public class SaveDiagnosticResponseRequest
{
    public int NumericResponse { get; set; }
    public string TextResponse { get; set; } = string.Empty;
}

public class SaveDiagnosticLensNoteRequest
{
    public string NoteText { get; set; } = string.Empty;
}

public class LoadDiagnosticResponse
{
    public int DiagnosticId { get; set; }
    public int ProcessId { get; set; }
    public string Status { get; set; } = string.Empty;
    public List<DiagnosticResponseData> Questions { get; set; } = new();
    public List<DiagnosticLensNoteData> LensNotes { get; set; } = new();
}

public class DiagnosticResponseData
{
    public int QuestionId { get; set; }
    public int NumericResponse { get; set; }
    public string TextResponse { get; set; } = string.Empty;
    public DateTime? AnsweredAt { get; set; }
}

public class DiagnosticLensNoteData
{
    public string LensKey { get; set; } = string.Empty;
    public string NoteText { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
}

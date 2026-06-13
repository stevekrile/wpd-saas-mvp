using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Wpd.Domain.Entities;

public class Lens
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public string PublicDescription { get; set; } = string.Empty;
    public string InternalDescription { get; set; } = string.Empty;

    // Navigation properties
    public ICollection<DiagnosticQuestion> DiagnosticQuestions { get; set; } = new List<DiagnosticQuestion>();
    public ICollection<LensScore> LensScores { get; set; } = new List<LensScore>();
    public ICollection<SystemTension> SystemTensions { get; set; } = new List<SystemTension>();
}

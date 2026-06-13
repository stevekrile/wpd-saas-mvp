using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Wpd.Domain.Enums;

namespace Wpd.Domain.Entities
{
    public class Process
    {
        public int Id { get; set; }
        public int WorkspaceId { get; set; }
        public string OwnerUserId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string ProblemStatement { get; set; } = string.Empty;
        public string Context { get; set; } = string.Empty;
        public ProcessStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        // Navigation properties
        public Workspace Workspace { get; set; } = null!;
        public ICollection<Diagnostic> Diagnostics { get; set; } = new List<Diagnostic>();
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Wpd.Domain.Enums;

namespace Wpd.Domain.Entities
{
    public class Workspace
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string OwnerUserId { get; set; } = string.Empty;
        public int? OrganizationId { get; set; }
        public WorkspaceType WorkspaceType { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsActive { get; set; }
        
        // Navigation properties
        public Organization? Organization { get; set; }
        public ICollection<Process> Processes { get; set; } = new List<Process>();
    }
}

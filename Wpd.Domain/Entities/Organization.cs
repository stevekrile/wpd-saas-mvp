using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Wpd.Domain.Entities;

public class Organization
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public bool IsActive { get; set; }
    
    // Navigation properties
    public ICollection<Workspace> Workspaces { get; set; } = new List<Workspace>();
}

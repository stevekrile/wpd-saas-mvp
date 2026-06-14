using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wpd.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CascadeDeleteDiagnosticOnProcess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Diagnostics_Processes_ProcessId",
                table: "Diagnostics");

            migrationBuilder.AddForeignKey(
                name: "FK_Diagnostics_Processes_ProcessId",
                table: "Diagnostics",
                column: "ProcessId",
                principalTable: "Processes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Diagnostics_Processes_ProcessId",
                table: "Diagnostics");

            migrationBuilder.AddForeignKey(
                name: "FK_Diagnostics_Processes_ProcessId",
                table: "Diagnostics",
                column: "ProcessId",
                principalTable: "Processes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}

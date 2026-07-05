using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wpd.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDiagnosticLlmResultHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DiagnosticLlmResults",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DiagnosticId = table.Column<int>(type: "int", nullable: false),
                    ResultMarkdown = table.Column<string>(type: "nvarchar(max)", maxLength: 16000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DiagnosticLlmResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DiagnosticLlmResults_Diagnostics_DiagnosticId",
                        column: x => x.DiagnosticId,
                        principalTable: "Diagnostics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DiagnosticLlmResults_DiagnosticId_CreatedAt",
                table: "DiagnosticLlmResults",
                columns: new[] { "DiagnosticId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DiagnosticLlmResults");
        }
    }
}

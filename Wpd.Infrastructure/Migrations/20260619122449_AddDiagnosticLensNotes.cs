using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wpd.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDiagnosticLensNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DiagnosticLensNotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DiagnosticId = table.Column<int>(type: "int", nullable: false),
                    LensKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NoteText = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DiagnosticLensNotes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DiagnosticLensNotes_Diagnostics_DiagnosticId",
                        column: x => x.DiagnosticId,
                        principalTable: "Diagnostics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DiagnosticLensNotes_DiagnosticId_LensKey",
                table: "DiagnosticLensNotes",
                columns: new[] { "DiagnosticId", "LensKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DiagnosticLensNotes");
        }
    }
}

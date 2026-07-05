using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wpd.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLlmProviderAndTokenMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CurrentLlmCompletionTokens",
                table: "Diagnostics",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentLlmModel",
                table: "Diagnostics",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CurrentLlmPromptTokens",
                table: "Diagnostics",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentLlmProvider",
                table: "Diagnostics",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CurrentLlmTotalTokens",
                table: "Diagnostics",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CompletionTokens",
                table: "DiagnosticLlmResults",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Model",
                table: "DiagnosticLlmResults",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PromptTokens",
                table: "DiagnosticLlmResults",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Provider",
                table: "DiagnosticLlmResults",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TotalTokens",
                table: "DiagnosticLlmResults",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CurrentLlmCompletionTokens",
                table: "Diagnostics");

            migrationBuilder.DropColumn(
                name: "CurrentLlmModel",
                table: "Diagnostics");

            migrationBuilder.DropColumn(
                name: "CurrentLlmPromptTokens",
                table: "Diagnostics");

            migrationBuilder.DropColumn(
                name: "CurrentLlmProvider",
                table: "Diagnostics");

            migrationBuilder.DropColumn(
                name: "CurrentLlmTotalTokens",
                table: "Diagnostics");

            migrationBuilder.DropColumn(
                name: "CompletionTokens",
                table: "DiagnosticLlmResults");

            migrationBuilder.DropColumn(
                name: "Model",
                table: "DiagnosticLlmResults");

            migrationBuilder.DropColumn(
                name: "PromptTokens",
                table: "DiagnosticLlmResults");

            migrationBuilder.DropColumn(
                name: "Provider",
                table: "DiagnosticLlmResults");

            migrationBuilder.DropColumn(
                name: "TotalTokens",
                table: "DiagnosticLlmResults");
        }
    }
}

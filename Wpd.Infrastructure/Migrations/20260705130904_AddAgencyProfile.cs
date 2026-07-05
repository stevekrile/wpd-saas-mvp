using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Wpd.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAgencyProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AgencyProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgencyProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AgencyLensAssessments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AgencyProfileId = table.Column<int>(type: "int", nullable: false),
                    LensKey = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LensName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    StatementNumber = table.Column<int>(type: "int", nullable: false),
                    StatementText = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    AgencyScore = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgencyLensAssessments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgencyLensAssessments_AgencyProfiles_AgencyProfileId",
                        column: x => x.AgencyProfileId,
                        principalTable: "AgencyProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgencyLensAssessments_AgencyProfileId_LensKey_StatementNumber",
                table: "AgencyLensAssessments",
                columns: new[] { "AgencyProfileId", "LensKey", "StatementNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AgencyProfiles_UserId",
                table: "AgencyProfiles",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AgencyLensAssessments");

            migrationBuilder.DropTable(
                name: "AgencyProfiles");
        }
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrackerStats.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHitAndRunsToStats : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "HitAndRuns",
                table: "IntegrationSnapshots",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HitAndRuns",
                table: "Integrations",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HitAndRuns",
                table: "IntegrationSnapshots");

            migrationBuilder.DropColumn(
                name: "HitAndRuns",
                table: "Integrations");
        }
    }
}

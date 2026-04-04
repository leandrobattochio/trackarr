using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrackerStats.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddLeechingAndCompletedTorrentCounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CompletedTorrents",
                table: "IntegrationSnapshots",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LeechingTorrents",
                table: "IntegrationSnapshots",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CompletedTorrents",
                table: "Integrations",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LeechingTorrents",
                table: "Integrations",
                type: "INTEGER",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompletedTorrents",
                table: "IntegrationSnapshots");

            migrationBuilder.DropColumn(
                name: "LeechingTorrents",
                table: "IntegrationSnapshots");

            migrationBuilder.DropColumn(
                name: "CompletedTorrents",
                table: "Integrations");

            migrationBuilder.DropColumn(
                name: "LeechingTorrents",
                table: "Integrations");
        }
    }
}

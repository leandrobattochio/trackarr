using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrackerStats.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveCompletedTorrents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CompletedTorrents",
                table: "IntegrationSnapshots");

            migrationBuilder.DropColumn(
                name: "CompletedTorrents",
                table: "Integrations");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CompletedTorrents",
                table: "IntegrationSnapshots",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CompletedTorrents",
                table: "Integrations",
                type: "INTEGER",
                nullable: true);
        }
    }
}

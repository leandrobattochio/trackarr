using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrackerStats.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SplitSeedBonusAndBufferBytes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Bon",
                table: "IntegrationSnapshots");

            migrationBuilder.DropColumn(
                name: "Bon",
                table: "Integrations");

            migrationBuilder.AddColumn<string>(
                name: "Buffer",
                table: "IntegrationSnapshots",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SeedBonus",
                table: "IntegrationSnapshots",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Buffer",
                table: "Integrations",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SeedBonus",
                table: "Integrations",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Buffer",
                table: "IntegrationSnapshots");

            migrationBuilder.DropColumn(
                name: "SeedBonus",
                table: "IntegrationSnapshots");

            migrationBuilder.DropColumn(
                name: "Buffer",
                table: "Integrations");

            migrationBuilder.DropColumn(
                name: "SeedBonus",
                table: "Integrations");

            migrationBuilder.AddColumn<long>(
                name: "Bon",
                table: "IntegrationSnapshots",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "Bon",
                table: "Integrations",
                type: "INTEGER",
                nullable: true);
        }
    }
}

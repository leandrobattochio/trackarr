using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrackerStats.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Integrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    PluginId = table.Column<string>(type: "TEXT", nullable: false),
                    Payload = table.Column<string>(type: "TEXT", nullable: false),
                    LastSyncAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Ratio = table.Column<decimal>(type: "TEXT", nullable: true),
                    UploadedBytes = table.Column<long>(type: "INTEGER", nullable: true),
                    DownloadedBytes = table.Column<long>(type: "INTEGER", nullable: true),
                    RequiredRatio = table.Column<decimal>(type: "TEXT", nullable: true),
                    SeedingTorrents = table.Column<int>(type: "INTEGER", nullable: true),
                    ActiveTorrents = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Integrations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IntegrationSnapshots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    IntegrationId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CapturedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Ratio = table.Column<decimal>(type: "TEXT", nullable: true),
                    UploadedBytes = table.Column<long>(type: "INTEGER", nullable: true),
                    DownloadedBytes = table.Column<long>(type: "INTEGER", nullable: true),
                    RequiredRatio = table.Column<decimal>(type: "TEXT", nullable: true),
                    SeedingTorrents = table.Column<int>(type: "INTEGER", nullable: true),
                    ActiveTorrents = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_IntegrationSnapshots", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Integrations");

            migrationBuilder.DropTable(
                name: "IntegrationSnapshots");
        }
    }
}

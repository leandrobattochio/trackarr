using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

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
                name: "ApplicationSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserAgent = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApplicationSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Integrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PluginId = table.Column<string>(type: "text", nullable: false),
                    Payload = table.Column<string>(type: "text", nullable: false),
                    LastSyncAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastSyncResult = table.Column<string>(type: "text", nullable: true),
                    Ratio = table.Column<decimal>(type: "numeric", nullable: true),
                    UploadedBytes = table.Column<long>(type: "bigint", nullable: true),
                    DownloadedBytes = table.Column<long>(type: "bigint", nullable: true),
                    SeedBonus = table.Column<string>(type: "text", nullable: true),
                    Buffer = table.Column<string>(type: "text", nullable: true),
                    HitAndRuns = table.Column<int>(type: "integer", nullable: true),
                    RequiredRatio = table.Column<decimal>(type: "numeric", nullable: true),
                    SeedingTorrents = table.Column<int>(type: "integer", nullable: true),
                    LeechingTorrents = table.Column<int>(type: "integer", nullable: true),
                    ActiveTorrents = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Integrations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "IntegrationSnapshots",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IntegrationId = table.Column<Guid>(type: "uuid", nullable: false),
                    CapturedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Ratio = table.Column<decimal>(type: "numeric", nullable: true),
                    UploadedBytes = table.Column<long>(type: "bigint", nullable: true),
                    DownloadedBytes = table.Column<long>(type: "bigint", nullable: true),
                    SeedBonus = table.Column<string>(type: "text", nullable: true),
                    Buffer = table.Column<string>(type: "text", nullable: true),
                    HitAndRuns = table.Column<int>(type: "integer", nullable: true),
                    RequiredRatio = table.Column<decimal>(type: "numeric", nullable: true),
                    SeedingTorrents = table.Column<int>(type: "integer", nullable: true),
                    LeechingTorrents = table.Column<int>(type: "integer", nullable: true),
                    ActiveTorrents = table.Column<int>(type: "integer", nullable: true)
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
                name: "ApplicationSettings");

            migrationBuilder.DropTable(
                name: "Integrations");

            migrationBuilder.DropTable(
                name: "IntegrationSnapshots");
        }
    }
}

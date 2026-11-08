using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrackerStats.Infrastructure.Migrations.Postgres
{
    /// <inheritdoc />
    public partial class WhatsNewState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WhatsNewState",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    LastReadAppVersion = table.Column<string>(type: "text", nullable: true),
                    LastReadPluginChangeId = table.Column<long>(type: "bigint", nullable: true),
                    LastReadAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WhatsNewState", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "WhatsNewState",
                columns: new[] { "Id", "LastReadAppVersion", "LastReadAt", "LastReadPluginChangeId" },
                values: new object[] { 1, null, null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WhatsNewState");
        }
    }
}

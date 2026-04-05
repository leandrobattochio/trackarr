using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrackerStats.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPluginDefinitions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PluginDefinitions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    PluginId = table.Column<string>(type: "TEXT", nullable: false),
                    DefinitionJson = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PluginDefinitions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PluginDefinitions_PluginId",
                table: "PluginDefinitions",
                column: "PluginId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PluginDefinitions");
        }
    }
}

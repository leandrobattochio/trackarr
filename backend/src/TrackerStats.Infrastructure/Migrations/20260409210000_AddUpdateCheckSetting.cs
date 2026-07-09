using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrackerStats.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUpdateCheckSetting : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CheckForUpdatesOverride",
                table: "ApplicationSettings",
                type: "boolean",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CheckForUpdatesOverride",
                table: "ApplicationSettings");
        }
    }
}

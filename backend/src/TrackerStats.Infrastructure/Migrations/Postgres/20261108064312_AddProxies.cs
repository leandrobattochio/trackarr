using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TrackerStats.Infrastructure.Migrations.Postgres
{
    /// <inheritdoc />
    public partial class AddProxies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ProxyId",
                table: "Integrations",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Proxies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Host = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Port = table.Column<int>(type: "integer", nullable: false),
                    Username = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Password = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Proxies", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Integrations_ProxyId",
                table: "Integrations",
                column: "ProxyId");

            migrationBuilder.CreateIndex(
                name: "IX_Proxies_Name",
                table: "Proxies",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Integrations_Proxies_ProxyId",
                table: "Integrations",
                column: "ProxyId",
                principalTable: "Proxies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Integrations_Proxies_ProxyId",
                table: "Integrations");

            migrationBuilder.DropTable(
                name: "Proxies");

            migrationBuilder.DropIndex(
                name: "IX_Integrations_ProxyId",
                table: "Integrations");

            migrationBuilder.DropColumn(
                name: "ProxyId",
                table: "Integrations");
        }
    }
}

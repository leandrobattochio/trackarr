FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["src/TrackerStats.Api/TrackerStats.Api.csproj", "src/TrackerStats.Api/"]
COPY ["src/TrackerStats.Application/TrackerStats.Application.csproj", "src/TrackerStats.Application/"]
COPY ["src/TrackerStats.Domain/TrackerStats.Domain.csproj", "src/TrackerStats.Domain/"]
COPY ["src/TrackerStats.Infrastructure/TrackerStats.Infrastructure.csproj", "src/TrackerStats.Infrastructure/"]
RUN dotnet restore "src/TrackerStats.Api/TrackerStats.Api.csproj"
COPY . .
WORKDIR "/src/src/TrackerStats.Api"
RUN dotnet build "TrackerStats.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "TrackerStats.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "TrackerStats.Api.dll"]

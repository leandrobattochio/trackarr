ARG APP_TIMEZONE=America/Sao_Paulo

FROM node:22-bookworm-slim AS frontend-build
ARG APP_TIMEZONE
ENV VITE_APP_TIMEZONE=${APP_TIMEZONE}
WORKDIR /src/frontend
COPY frontend/package.json ./
COPY frontend/yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile
COPY frontend/ ./
RUN yarn build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src
COPY backend/TrackerStats.sln ./backend/
COPY backend/src/TrackerStats.Api/TrackerStats.Api.csproj ./backend/src/TrackerStats.Api/
COPY backend/src/TrackerStats.Application/TrackerStats.Application.csproj ./backend/src/TrackerStats.Application/
COPY backend/src/TrackerStats.Domain/TrackerStats.Domain.csproj ./backend/src/TrackerStats.Domain/
COPY backend/src/TrackerStats.Infrastructure/TrackerStats.Infrastructure.csproj ./backend/src/TrackerStats.Infrastructure/
RUN dotnet restore ./backend/src/TrackerStats.Api/TrackerStats.Api.csproj
COPY backend/ ./backend/
WORKDIR /src/backend/src/TrackerStats.Api
RUN dotnet publish TrackerStats.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
ARG APP_TIMEZONE
WORKDIR /app
ENV ASPNETCORE_URLS=http://0.0.0.0:3000
ENV APP_TIMEZONE=${APP_TIMEZONE}
ENV TZ=${APP_TIMEZONE}
USER root
RUN mkdir -p /data
EXPOSE 3000
COPY --from=backend-build /app/publish ./
COPY --from=frontend-build /src/frontend/dist ./wwwroot
ENTRYPOINT ["dotnet", "TrackerStats.Api.dll"]

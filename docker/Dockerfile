ARG APP_TIMEZONE=America/Sao_Paulo
ARG APP_VERSION=1.0.0
# Must end with "/".
ARG PLUGIN_SOURCE_URL=https://raw.githubusercontent.com/leandrobattochio/trackarr-plugins/main/

FROM node:22-bookworm-slim AS plugin-snapshot
ARG PLUGIN_SOURCE_URL
# ADD re-fetches the index on every build, so a new trackarr-plugins commit invalidates the cache.
ADD ${PLUGIN_SOURCE_URL}index.json /tmp/plugin-source/index.json
COPY docker/fetch-plugin-snapshot.mjs /tmp/fetch-plugin-snapshot.mjs
RUN node /tmp/fetch-plugin-snapshot.mjs "${PLUGIN_SOURCE_URL}" /tmp/plugin-source/index.json /plugin-snapshot

FROM node:22-bookworm-slim AS frontend-build
ARG APP_TIMEZONE
ENV VITE_APP_TIMEZONE=${APP_TIMEZONE}
# vite build needs the devDependencies, but not the Cypress binary they would download.
ENV CYPRESS_INSTALL_BINARY=0
WORKDIR /src/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN npm install -g pnpm@12.11.2 && pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
ARG APP_VERSION
WORKDIR /src
COPY backend/Directory.Packages.props ./backend/
COPY backend/src/TrackerStats.Api/TrackerStats.Api.csproj ./backend/src/TrackerStats.Api/
COPY backend/src/TrackerStats.Application/TrackerStats.Application.csproj ./backend/src/TrackerStats.Application/
COPY backend/src/TrackerStats.Domain/TrackerStats.Domain.csproj ./backend/src/TrackerStats.Domain/
COPY backend/src/TrackerStats.Infrastructure/TrackerStats.Infrastructure.csproj ./backend/src/TrackerStats.Infrastructure/
COPY backend/src/TrackerStats.PluginEngine/TrackerStats.PluginEngine.csproj ./backend/src/TrackerStats.PluginEngine/
RUN dotnet restore ./backend/src/TrackerStats.Api/TrackerStats.Api.csproj
COPY backend/ ./backend/
WORKDIR /src/backend/src/TrackerStats.Api
RUN dotnet publish TrackerStats.Api.csproj -c Release -o /app/publish /p:UseAppHost=false /p:Version=${APP_VERSION} /p:InformationalVersion=${APP_VERSION}

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
ARG APP_TIMEZONE
WORKDIR /app
ENV ASPNETCORE_URLS=http://0.0.0.0:3000
ENV APP_TIMEZONE=${APP_TIMEZONE}
ENV TZ=${APP_TIMEZONE}
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data
EXPOSE 3000
COPY --from=backend-build /app/publish ./
COPY --from=frontend-build /src/frontend/dist ./wwwroot
COPY --from=plugin-snapshot /plugin-snapshot ./plugin-snapshot
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

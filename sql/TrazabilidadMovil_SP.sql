-- =============================================
-- Procedimiento: sp_TrazabilidadMovilArrastreJSON
-- Descripción: Recibe datos de trazabilidad de clicks desde dispositivos móviles
-- y los almacena en una tabla temporal para su posterior procesamiento
-- =============================================
CREATE PROCEDURE sp_TrazabilidadMovilArrastreJSON
    @json NVARCHAR(MAX),
    @sucursal INT,
    @idUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Validar formato JSON
        IF ISJSON(@json) <> 1
        BEGIN
            THROW 50001, 'El formato del JSON es inválido.', 1;
            RETURN;
        END

        -- Crear tabla temporal si no existe
        IF OBJECT_ID('tempdb..#TempTrazabilidadMovil') IS NULL
        BEGIN
        CREATE TABLE #TempTrazabilidadMovil
        (
            id NVARCHAR(50) PRIMARY KEY,
            idMovil NVARCHAR(50),
            idUsuario INT,
            nombreUsuario NVARCHAR(200),
            sucursal INT,
            fechaInicio DATETIME,
            fechaFinal DATETIME,
            duracionMs INT,
            pantalla NVARCHAR(100),
            accion NVARCHAR(200),
            tipoElemento NVARCHAR(50),
            etiqueta NVARCHAR(200),
            exitoso BIT,
            codigoError NVARCHAR(50),
            mensajeError NVARCHAR(MAX),
            parametros NVARCHAR(MAX),
            resultado NVARCHAR(MAX),
            ipDispositivo NVARCHAR(50),
            nombreDispositivo NVARCHAR(200),
            sistemaOperativo NVARCHAR(100),
            versionApp NVARCHAR(50),
            fechaRecepcion DATETIME DEFAULT GETDATE()
        );
    END

        -- Limpiar datos anteriores de la misma sucursal
        DELETE FROM #TempTrazabilidadMovil
        WHERE sucursal = @sucursal;

        -- Insertar datos desde el JSON filtrando por sucursal
        INSERT INTO #TempTrazabilidadMovil
        (
        id,
        idMovil,
        idUsuario,
        nombreUsuario,
        sucursal,
        fechaInicio,
        fechaFinal,
        duracionMs,
        pantalla,
        accion,
        tipoElemento,
        etiqueta,
        exitoso,
        codigoError,
        mensajeError,
        parametros,
        resultado,
        ipDispositivo,
        nombreDispositivo,
        sistemaOperativo,
        versionApp
        )
    SELECT
        j.id,
        j.idMovil,
        j.idUsuario,
        j.nombreUsuario,
        j.sucursal,
        j.fechaInicio,
        j.fechaFinal,
        j.duracionMs,
        j.pantalla,
        j.accion,
        j.tipoElemento,
        j.etiqueta,
        j.exitoso,
        j.codigoError,
        j.mensajeError,
        j.parametros,
        j.resultado,
        j.ipDispositivo,
        j.nombreDispositivo,
        j.sistemaOperativo,
        j.versionApp
    FROM OPENJSON(@json)
        WITH (
            id NVARCHAR(50),
            idMovil NVARCHAR(50),
            idUsuario INT,
            nombreUsuario NVARCHAR(200),
            sucursal INT,
            fechaInicio DATETIME,
            fechaFinal DATETIME,
            duracionMs INT,
            pantalla NVARCHAR(100),
            accion NVARCHAR(200),
            tipoElemento NVARCHAR(50),
            etiqueta NVARCHAR(200),
            exitoso BIT,
            codigoError NVARCHAR(50),
            mensajeError NVARCHAR(MAX),
            parametros NVARCHAR(MAX),
            resultado NVARCHAR(MAX),
            ipDispositivo NVARCHAR(50),
            nombreDispositivo NVARCHAR(200),
            sistemaOperativo NVARCHAR(100),
            versionApp NVARCHAR(50)
        ) j
    WHERE j.sucursal = @sucursal;

        -- Insertar en tabla permanente (crear si no existe)
        IF OBJECT_ID('dbo.TrazabilidadMovil', 'U') IS NULL
        BEGIN
        CREATE TABLE dbo.TrazabilidadMovil
        (
            id NVARCHAR(50) PRIMARY KEY,
            idMovil NVARCHAR(50),
            idUsuario INT,
            nombreUsuario NVARCHAR(200),
            sucursal INT,
            fechaInicio DATETIME,
            fechaFinal DATETIME,
            duracionMs INT,
            pantalla NVARCHAR(100),
            accion NVARCHAR(200),
            tipoElemento NVARCHAR(50),
            etiqueta NVARCHAR(200),
            exitoso BIT,
            codigoError NVARCHAR(50),
            mensajeError NVARCHAR(MAX),
            parametros NVARCHAR(MAX),
            resultado NVARCHAR(MAX),
            ipDispositivo NVARCHAR(50),
            nombreDispositivo NVARCHAR(200),
            sistemaOperativo NVARCHAR(100),
            versionApp NVARCHAR(50),
            fechaRecepcion DATETIME DEFAULT GETDATE(),
            INDEX IX_TrazabilidadMovil_Sucursal (sucursal),
            INDEX IX_TrazabilidadMovil_Usuario (idUsuario),
            INDEX IX_TrazabilidadMovil_Fecha (fechaInicio),
            INDEX IX_TrazabilidadMovil_Pantalla (pantalla),
            INDEX IX_TrazabilidadMovil_Accion (accion)
        );
    END

        -- Insertar o actualizar en tabla permanente
        MERGE dbo.TrazabilidadMovil AS target
        USING #TempTrazabilidadMovil AS source
        ON target.id = source.id
        WHEN MATCHED THEN
            UPDATE SET
                fechaFinal = source.fechaFinal,
                duracionMs = source.duracionMs,
                exitoso = source.exitoso,
                codigoError = source.codigoError,
                mensajeError = source.mensajeError,
                resultado = source.resultado
        WHEN NOT MATCHED THEN
            INSERT (
                id, idMovil, idUsuario, nombreUsuario, sucursal,
                fechaInicio, fechaFinal, duracionMs, pantalla, accion,
                tipoElemento, etiqueta, exitoso, codigoError, mensajeError,
                parametros, resultado, ipDispositivo, nombreDispositivo,
                sistemaOperativo, versionApp
            )
            VALUES (
                source.id, source.idMovil, source.idUsuario, source.nombreUsuario, source.sucursal,
                source.fechaInicio, source.fechaFinal, source.duracionMs, source.pantalla, source.accion,
                source.tipoElemento, source.etiqueta, source.exitoso, source.codigoError, source.mensajeError,
                source.parametros, source.resultado, source.ipDispositivo, source.nombreDispositivo,
                source.sistemaOperativo, source.versionApp
            );

        COMMIT TRANSACTION;

        -- Retornar estadísticas
        SELECT
        COUNT(*) AS RegistrosProcesados,
        @sucursal AS Sucursal,
        GETDATE() AS FechaProcesamiento;

    END
    TRY
    BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();

    RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

-- =============================================
-- Procedimiento auxiliar: sp_ObtenerEstadisticasTrazabilidad
-- Descripción: Obtiene estadísticas de trazabilidad por sucursal y período
-- =============================================
CREATE PROCEDURE sp_ObtenerEstadisticasTrazabilidad
    @sucursal INT,
    @fechaInicio DATETIME,
    @fechaFin DATETIME
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        pantalla,
        accion,
        COUNT(*) AS TotalClicks,
        SUM(CASE WHEN exitoso = 1 THEN 1 ELSE 0 END) AS ClicksExitosos,
        SUM(CASE WHEN exitoso = 0 THEN 1 ELSE 0 END) AS ClicksFallidos,
        AVG(duracionMs) AS DuracionPromedioMs,
        MIN(duracionMs) AS DuracionMinimaMs,
        MAX(duracionMs) AS DuracionMaximaMs,
        COUNT(DISTINCT idUsuario) AS UsuariosUnicos,
        COUNT(DISTINCT idMovil) AS DispositivosUnicos
    FROM dbo.TrazabilidadMovil
    WHERE sucursal = @sucursal
        AND fechaInicio BETWEEN @fechaInicio AND @fechaFin
    GROUP BY pantalla, accion
    ORDER BY TotalClicks DESC;
END
GO

-- ===========================================================================
-- SISTEMA DE BITÁCORA PARA SINCRONIZACIONES MÓVILES
-- ===========================================================================
-- Este script crea la tabla y procedimientos necesarios para el registro
-- completo de todas las sincronizaciones realizadas desde dispositivos móviles.
-- ===========================================================================

-- 1. TABLA PRINCIPAL DE BITÁCORA
-- ===========================================================================
IF NOT EXISTS (SELECT *
FROM sysobjects
WHERE name='BitacoraSync' AND xtype='U')
BEGIN
    CREATE TABLE BitacoraSync
    (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        idBitacoraMovil NVARCHAR(100) NOT NULL,
        -- ID único generado en el móvil
        fechaInicio DATETIME NOT NULL,
        -- Fecha/hora inicio sincronización
        fechaFinal DATETIME NULL,
        -- Fecha/hora fin sincronización
        duracionMs INT NULL,
        -- Duración en milisegundos

        -- Información del usuario
        idUsuario INT NULL,
        -- ID del usuario
        nombreUsuario NVARCHAR(200) NULL,
        -- Nombre del usuario

        -- Información del dispositivo
        ipDispositivo NVARCHAR(50) NULL,
        -- IP del dispositivo
        nombreDispositivo NVARCHAR(200) NULL,
        -- Nombre/modelo del dispositivo
        sistemaOperativo NVARCHAR(100) NULL,
        -- SO y versión
        versionApp NVARCHAR(50) NULL,
        -- Versión de la aplicación

        -- Información de la sincronización
        sucursal INT NOT NULL,
        -- Sucursal sincronizada
        tabla NVARCHAR(100) NOT NULL,
        -- Nombre de la tabla sincronizada
        tipoSync NVARCHAR(50) NOT NULL,
        -- 'completa', 'incremental', 'manual'
        endpoint NVARCHAR(500) NULL,
        -- Endpoint utilizado

        -- Estadísticas
        registrosLeidos INT NULL DEFAULT 0,
        -- Registros obtenidos de la API
        registrosGuardados INT NULL DEFAULT 0,
        -- Registros nuevos insertados
        registrosActualizados INT NULL DEFAULT 0,
        -- Registros actualizados
        registrosEliminados INT NULL DEFAULT 0,
        -- Registros eliminados

        -- Estado y errores
        exitoso BIT NOT NULL DEFAULT 1,
        -- 1=Éxito, 0=Error
        codigoError NVARCHAR(50) NULL,
        -- Código de error si aplica
        descripcionError NVARCHAR(MAX) NULL,
        -- Descripción detallada del error
        stackTrace NVARCHAR(MAX) NULL,
        -- Stack trace si hay excepción

        -- Metadatos
        detallesJSON NVARCHAR(MAX) NULL,
        -- JSON con detalles adicionales
        fechaArrastre DATETIME DEFAULT GETDATE(),
        -- Fecha en que se recibió el registro

        -- Índices para consultas frecuentes
        INDEX IX_BitacoraSync_Fecha (fechaInicio DESC),
        INDEX IX_BitacoraSync_Sucursal (sucursal, fechaInicio DESC),
        INDEX IX_BitacoraSync_Usuario (idUsuario, fechaInicio DESC),
        INDEX IX_BitacoraSync_Tabla (tabla, fechaInicio DESC),
        INDEX IX_BitacoraSync_Exitoso (exitoso, fechaInicio DESC),
        INDEX IX_BitacoraSync_IdMovil (idBitacoraMovil)
    );

    PRINT '✅ Tabla BitacoraSync creada exitosamente';
END
ELSE
BEGIN
    PRINT '⚠️ La tabla BitacoraSync ya existe';
END
GO

-- 2. TABLA DE RESUMEN DE SINCRONIZACIÓN (para sesiones completas)
-- ===========================================================================
IF NOT EXISTS (SELECT *
FROM sysobjects
WHERE name='BitacoraSyncSesion' AND xtype='U')
BEGIN
    CREATE TABLE BitacoraSyncSesion
    (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        idSesionMovil NVARCHAR(100) NOT NULL,
        -- ID de sesión generado en el móvil
        fechaInicio DATETIME NOT NULL,
        fechaFinal DATETIME NULL,
        duracionTotalMs INT NULL,

        -- Usuario y dispositivo
        idUsuario INT NULL,
        nombreUsuario NVARCHAR(200) NULL,
        ipDispositivo NVARCHAR(50) NULL,
        nombreDispositivo NVARCHAR(200) NULL,

        -- Información de la sincronización
        sucursal INT NOT NULL,
        tipoSync NVARCHAR(50) NOT NULL,

        -- Estadísticas globales
        totalTablas INT NULL DEFAULT 0,
        tablasExitosas INT NULL DEFAULT 0,
        tablasConError INT NULL DEFAULT 0,
        totalRegistros INT NULL DEFAULT 0,

        -- Estado
        exitoso BIT NOT NULL DEFAULT 1,
        resumenErrores NVARCHAR(MAX) NULL,

        fechaArrastre DATETIME DEFAULT GETDATE(),

        INDEX IX_BitacoraSyncSesion_Fecha (fechaInicio DESC),
        INDEX IX_BitacoraSyncSesion_Sucursal (sucursal, fechaInicio DESC),
        INDEX IX_BitacoraSyncSesion_IdMovil (idSesionMovil)
    );

    PRINT '✅ Tabla BitacoraSyncSesion creada exitosamente';
END
GO

-- 3. PROCEDIMIENTO ALMACENADO: ARRASTRE DE BITÁCORAS
-- ===========================================================================
CREATE OR ALTER PROCEDURE sp_BitacoraSyncArrastreJSON
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
            THROW 50001, 'El formato del JSON de bitácora es inválido.', 1;
            RETURN;
        END
        
        -- Insertar registros de bitácora desde el JSON
        INSERT INTO BitacoraSync
        (
        idBitacoraMovil,
        fechaInicio,
        fechaFinal,
        duracionMs,
        idUsuario,
        nombreUsuario,
        ipDispositivo,
        nombreDispositivo,
        sistemaOperativo,
        versionApp,
        sucursal,
        tabla,
        tipoSync,
        endpoint,
        registrosLeidos,
        registrosGuardados,
        registrosActualizados,
        registrosEliminados,
        exitoso,
        codigoError,
        descripcionError,
        stackTrace,
        detallesJSON,
        fechaArrastre
        )
    SELECT
        j.idBitacoraMovil,
        j.fechaInicio,
        j.fechaFinal,
        j.duracionMs,
        COALESCE(j.idUsuario, @idUsuario),
        j.nombreUsuario,
        j.ipDispositivo,
        j.nombreDispositivo,
        j.sistemaOperativo,
        j.versionApp,
        COALESCE(j.sucursal, @sucursal),
        j.tabla,
        j.tipoSync,
        j.endpoint,
        COALESCE(j.registrosLeidos, 0),
        COALESCE(j.registrosGuardados, 0),
        COALESCE(j.registrosActualizados, 0),
        COALESCE(j.registrosEliminados, 0),
        COALESCE(j.exitoso, 1),
        j.codigoError,
        j.descripcionError,
        j.stackTrace,
        j.detallesJSON,
        GETDATE()
    FROM OPENJSON(@json)
        WITH (
            idBitacoraMovil     NVARCHAR(100)   '$.idBitacoraMovil',
            fechaInicio         DATETIME        '$.fechaInicio',
            fechaFinal          DATETIME        '$.fechaFinal',
            duracionMs          INT             '$.duracionMs',
            idUsuario           INT             '$.idUsuario',
            nombreUsuario       NVARCHAR(200)   '$.nombreUsuario',
            ipDispositivo       NVARCHAR(50)    '$.ipDispositivo',
            nombreDispositivo   NVARCHAR(200)   '$.nombreDispositivo',
            sistemaOperativo    NVARCHAR(100)   '$.sistemaOperativo',
            versionApp          NVARCHAR(50)    '$.versionApp',
            sucursal            INT             '$.sucursal',
            tabla               NVARCHAR(100)   '$.tabla',
            tipoSync            NVARCHAR(50)    '$.tipoSync',
            endpoint            NVARCHAR(500)   '$.endpoint',
            registrosLeidos     INT             '$.registrosLeidos',
            registrosGuardados  INT             '$.registrosGuardados',
            registrosActualizados INT           '$.registrosActualizados',
            registrosEliminados INT             '$.registrosEliminados',
            exitoso             BIT             '$.exitoso',
            codigoError         NVARCHAR(50)    '$.codigoError',
            descripcionError    NVARCHAR(MAX)   '$.descripcionError',
            stackTrace          NVARCHAR(MAX)   '$.stackTrace',
            detallesJSON        NVARCHAR(MAX)   '$.detallesJSON'
        ) j
    -- Solo insertar registros que no existan ya (evitar duplicados)
    WHERE NOT EXISTS (
            SELECT 1
    FROM BitacoraSync b
    WHERE b.idBitacoraMovil = j.idBitacoraMovil
        );
        
        DECLARE @registrosInsertados INT = @@ROWCOUNT;
        
        COMMIT TRANSACTION;
        
        -- Retornar resultado
        SELECT
        'OK' AS resultado,
        @registrosInsertados AS registrosInsertados,
        GETDATE() AS fechaProceso;
            
    END
    TRY
    BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();
    DECLARE @ErrorLine INT = ERROR_LINE();

    -- Registrar el error en la misma tabla de bitácora
    INSERT INTO BitacoraSync
        (
        idBitacoraMovil,
        fechaInicio,
        fechaFinal,
        sucursal,
        tabla,
        tipoSync,
        idUsuario,
        exitoso,
        codigoError,
        descripcionError,
        stackTrace
        )
    VALUES
        (
            CONCAT('ERROR-', CONVERT(NVARCHAR(20), GETDATE(), 112), '-', NEWID()),
            GETDATE(),
            GETDATE(),
            @sucursal,
            'BitacoraSync',
            'arrastre-error',
            @idUsuario,
            0,
            CONCAT('SQL-', ERROR_NUMBER()),
            @ErrorMessage,
            CONCAT('Línea: ', @ErrorLine, ' - Severidad: ', @ErrorSeverity, ' - Estado: ', @ErrorState)
        );

    RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

PRINT '✅ Procedimiento sp_BitacoraSyncArrastreJSON creado exitosamente';
GO

-- 4. PROCEDIMIENTO ALMACENADO: ARRASTRE DE SESIONES
-- ===========================================================================
CREATE OR ALTER PROCEDURE sp_BitacoraSyncSesionArrastreJSON
    @json NVARCHAR(MAX),
    @sucursal INT,
    @idUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;
        
        IF ISJSON(@json) <> 1
        BEGIN
            THROW 50001, 'El formato del JSON de sesión es inválido.', 1;
            RETURN;
        END
        
        INSERT INTO BitacoraSyncSesion
        (
        idSesionMovil,
        fechaInicio,
        fechaFinal,
        duracionTotalMs,
        idUsuario,
        nombreUsuario,
        ipDispositivo,
        nombreDispositivo,
        sucursal,
        tipoSync,
        totalTablas,
        tablasExitosas,
        tablasConError,
        totalRegistros,
        exitoso,
        resumenErrores,
        fechaArrastre
        )
    SELECT
        j.idSesionMovil,
        j.fechaInicio,
        j.fechaFinal,
        j.duracionTotalMs,
        COALESCE(j.idUsuario, @idUsuario),
        j.nombreUsuario,
        j.ipDispositivo,
        j.nombreDispositivo,
        COALESCE(j.sucursal, @sucursal),
        j.tipoSync,
        COALESCE(j.totalTablas, 0),
        COALESCE(j.tablasExitosas, 0),
        COALESCE(j.tablasConError, 0),
        COALESCE(j.totalRegistros, 0),
        COALESCE(j.exitoso, 1),
        j.resumenErrores,
        GETDATE()
    FROM OPENJSON(@json)
        WITH (
            idSesionMovil       NVARCHAR(100)   '$.idSesionMovil',
            fechaInicio         DATETIME        '$.fechaInicio',
            fechaFinal          DATETIME        '$.fechaFinal',
            duracionTotalMs     INT             '$.duracionTotalMs',
            idUsuario           INT             '$.idUsuario',
            nombreUsuario       NVARCHAR(200)   '$.nombreUsuario',
            ipDispositivo       NVARCHAR(50)    '$.ipDispositivo',
            nombreDispositivo   NVARCHAR(200)   '$.nombreDispositivo',
            sucursal            INT             '$.sucursal',
            tipoSync            NVARCHAR(50)    '$.tipoSync',
            totalTablas         INT             '$.totalTablas',
            tablasExitosas      INT             '$.tablasExitosas',
            tablasConError      INT             '$.tablasConError',
            totalRegistros      INT             '$.totalRegistros',
            exitoso             BIT             '$.exitoso',
            resumenErrores      NVARCHAR(MAX)   '$.resumenErrores'
        ) j
    WHERE NOT EXISTS (
            SELECT 1
    FROM BitacoraSyncSesion s
    WHERE s.idSesionMovil = j.idSesionMovil
        );
        
        COMMIT TRANSACTION;
        
        SELECT 'OK' AS resultado, @@ROWCOUNT AS sesionesInsertadas;
        
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

PRINT '✅ Procedimiento sp_BitacoraSyncSesionArrastreJSON creado exitosamente';
GO

-- 5. VISTAS ÚTILES PARA REPORTES
-- ===========================================================================

-- Vista: Resumen de errores por día y tabla
CREATE OR ALTER VIEW vw_BitacoraSync_ErroresPorDia
AS
    SELECT
        CAST(fechaInicio AS DATE) AS fecha,
        sucursal,
        tabla,
        COUNT(*) AS totalSincronizaciones,
        SUM(CASE WHEN exitoso = 1 THEN 1 ELSE 0 END) AS exitosas,
        SUM(CASE WHEN exitoso = 0 THEN 1 ELSE 0 END) AS conError,
        CAST(SUM(CASE WHEN exitoso = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,2)) AS porcentajeExito
    FROM BitacoraSync
    GROUP BY CAST(fechaInicio AS DATE), sucursal, tabla;
GO

-- Vista: Últimas sincronizaciones con errores
CREATE OR ALTER VIEW vw_BitacoraSync_UltimosErrores
AS
    SELECT TOP 100
        id,
        fechaInicio,
        sucursal,
        tabla,
        tipoSync,
        nombreUsuario,
        ipDispositivo,
        codigoError,
        descripcionError,
        duracionMs
    FROM BitacoraSync
    WHERE exitoso = 0
    ORDER BY fechaInicio DESC;
GO

-- Vista: Estadísticas por usuario
CREATE OR ALTER VIEW vw_BitacoraSync_PorUsuario
AS
    SELECT
        idUsuario,
        nombreUsuario,
        sucursal,
        COUNT(*) AS totalSincronizaciones,
        SUM(CASE WHEN exitoso = 1 THEN 1 ELSE 0 END) AS exitosas,
        SUM(CASE WHEN exitoso = 0 THEN 1 ELSE 0 END) AS conError,
        SUM(registrosGuardados) AS totalRegistrosGuardados,
        SUM(registrosActualizados) AS totalRegistrosActualizados,
        AVG(duracionMs) AS duracionPromedioMs,
        MAX(fechaInicio) AS ultimaSincronizacion
    FROM BitacoraSync
    WHERE fechaInicio >= DATEADD(DAY, -30, GETDATE())
    GROUP BY idUsuario, nombreUsuario, sucursal;
GO

PRINT '✅ Vistas de reportes creadas exitosamente';
GO

-- 6. PROCEDIMIENTO DE LIMPIEZA (mantener últimos 90 días)
-- ===========================================================================
CREATE OR ALTER PROCEDURE sp_BitacoraSync_Limpieza
    @diasRetener INT = 90
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @fechaLimite DATETIME = DATEADD(DAY, -@diasRetener, GETDATE());
    DECLARE @registrosEliminados INT;

    BEGIN TRY
        BEGIN TRANSACTION;
        
        DELETE FROM BitacoraSync 
        WHERE fechaInicio < @fechaLimite;
        SET @registrosEliminados = @@ROWCOUNT;
        
        DELETE FROM BitacoraSyncSesion 
        WHERE fechaInicio < @fechaLimite;
        
        COMMIT TRANSACTION;
        
        SELECT
        'OK' AS resultado,
        @registrosEliminados AS registrosEliminados,
        @fechaLimite AS fechaLimite;
            
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR (@ErrorMessage, 16, 1);
    END CATCH
END
GO



PRINT '✅ Procedimiento sp_BitacoraSync_Limpieza creado exitosamente';
PRINT '';
PRINT '===========================================================================';
PRINT 'INSTALACIÓN COMPLETADA';
PRINT '===========================================================================';
PRINT 'Tablas creadas: BitacoraSync, BitacoraSyncSesion';
PRINT 'Procedimientos: sp_BitacoraSyncArrastreJSON, sp_BitacoraSyncSesionArrastreJSON, sp_BitacoraSync_Limpieza';
PRINT 'Vistas: vw_BitacoraSync_ErroresPorDia, vw_BitacoraSync_UltimosErrores, vw_BitacoraSync_PorUsuario';
PRINT '===========================================================================';
GO

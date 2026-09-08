import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ContractValidationPipe } from './common/pipes/contract-validation.pipe';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { StructuredLogger } from './logging/logging.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const structuredLogger = new StructuredLogger();
  app.useLogger(structuredLogger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const corsOriginsStr = configService.get<string>(
    'CORS_ORIGINS',
    'http://localhost:5173,http://localhost:3000',
  );
  const corsOrigins = corsOriginsStr.split(',').map((o) => o.trim());

  // CORS
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Middlewares & Global conventions
  app.use(cookieParser());
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(new ContractValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseTransformInterceptor(), new LoggingInterceptor());

  // OpenAPI / Swagger setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ITZiec Recruitment Platform API')
    .setDescription('Production-oriented API contract for ITZiec AI-Powered Recruitment Platform')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your 15-minute access JWT',
      },
      'bearer',
    )
    .addCookieAuth('itziec_refresh', {
      type: 'apiKey',
      in: 'cookie',
      name: 'itziec_refresh',
      description: 'Rotating HttpOnly refresh session cookie',
    })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  structuredLogger.log(`Application started on port ${port} with prefix /${apiPrefix}`);
}

bootstrap();

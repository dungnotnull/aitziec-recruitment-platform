import { ContractValidationPipe } from '../../src/common/pipes/contract-validation.pipe';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../../src/common/constants/error-codes';

import { Type } from 'class-transformer';
import { RecommendationQueryDto } from '../../src/ai/dto/recommendation.dto';

class TestDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMin: number;
}

describe('ContractValidationPipe (BE-1-016)', () => {
  let pipe: ContractValidationPipe;

  beforeEach(() => {
    pipe = new ContractValidationPipe();
  });

  it('rejects payloads with unknown/unwhitelisted properties', async () => {
    const payload = {
      title: 'Senior Engineer',
      salaryMin: 1000,
      unknownProp: 'should fail',
    };

    await expect(pipe.transform(payload, { type: 'body', metatype: TestDto })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('formats field validation errors into contract-compliant details array', async () => {
    const invalidPayload = {
      title: '',
      salaryMin: -50,
    };

    try {
      await pipe.transform(invalidPayload, { type: 'body', metatype: TestDto });
      throw new Error('Pipe should have thrown BadRequestException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BadRequestException);
      const res = err.getResponse();
      expect(res.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.message).toBe('The request contains invalid fields.');
      expect(Array.isArray(res.details)).toBe(true);
      expect(res.details.length).toBeGreaterThanOrEqual(2);

      const salaryError = res.details.find((d: any) => d.field === 'salaryMin');
      expect(salaryError).toBeDefined();
      expect(salaryError.code).toBe('MIN');
    }
  });

  it('successfully transforms and returns valid payload with correct types', async () => {
    const validPayload = {
      title: 'Staff Engineer',
      salaryMin: '25000000', // string that converts to number
    };

    const transformed = await pipe.transform(validPayload, {
      type: 'body',
      metatype: TestDto,
    });

    expect(transformed.title).toBe('Staff Engineer');
    expect(transformed.salaryMin).toBe(25000000);
  });

  describe('BE-9-001: RecommendationQueryDto validation & transform regressions', () => {
    it('transforms query string limit="20" into number 20', async () => {
      const transformed = await pipe.transform(
        { limit: '20' },
        { type: 'query', metatype: RecommendationQueryDto },
      );
      expect(typeof transformed.limit).toBe('number');
      expect(transformed.limit).toBe(20);
    });

    it('rejects limit="0" with 400 VALIDATION_ERROR', async () => {
      await expect(
        pipe.transform({ limit: '0' }, { type: 'query', metatype: RecommendationQueryDto }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects limit="51" with 400 VALIDATION_ERROR', async () => {
      await expect(
        pipe.transform({ limit: '51' }, { type: 'query', metatype: RecommendationQueryDto }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects decimal limit="10.5" with 400 VALIDATION_ERROR', async () => {
      await expect(
        pipe.transform({ limit: '10.5' }, { type: 'query', metatype: RecommendationQueryDto }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-numeric string limit="abc" with 400 VALIDATION_ERROR', async () => {
      await expect(
        pipe.transform({ limit: 'abc' }, { type: 'query', metatype: RecommendationQueryDto }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects repeated query limit=["20", "30"] with 400 VALIDATION_ERROR', async () => {
      await expect(
        pipe.transform(
          { limit: ['20', '30'] },
          { type: 'query', metatype: RecommendationQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

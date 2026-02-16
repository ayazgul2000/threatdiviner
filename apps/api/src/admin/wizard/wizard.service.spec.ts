import { Test, TestingModule } from '@nestjs/testing';
import { WizardService } from './wizard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('WizardService', () => {
  let service: WizardService;

  const mockPrisma = {
    wizardQuestion: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    wizardOption: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WizardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WizardService>(WizardService);

    jest.clearAllMocks();
  });

  describe('listQuestions', () => {
    it('should list all questions', async () => {
      const mockQuestions = [
        {
          id: '1',
          questionId: 'q_app_type',
          text: 'What type of application?',
          type: 'single-select',
          orderIndex: 0,
          isEntryPoint: true,
          isTerminal: false,
          status: 'live',
          _count: { options: 3 },
        },
      ];

      mockPrisma.wizardQuestion.findMany.mockResolvedValue(mockQuestions);
      mockPrisma.wizardQuestion.count.mockResolvedValue(1);

      const result = await service.listQuestions();

      expect(result.questions).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by search', async () => {
      mockPrisma.wizardQuestion.findMany.mockResolvedValue([]);
      mockPrisma.wizardQuestion.count.mockResolvedValue(0);

      await service.listQuestions({ search: 'cloud' });

      expect(mockPrisma.wizardQuestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('should filter by type', async () => {
      mockPrisma.wizardQuestion.findMany.mockResolvedValue([]);
      mockPrisma.wizardQuestion.count.mockResolvedValue(0);

      await service.listQuestions({ type: 'single-select' });

      expect(mockPrisma.wizardQuestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'single-select',
          }),
        })
      );
    });

    it('should filter by status', async () => {
      mockPrisma.wizardQuestion.findMany.mockResolvedValue([]);
      mockPrisma.wizardQuestion.count.mockResolvedValue(0);

      await service.listQuestions({ status: 'live' });

      expect(mockPrisma.wizardQuestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'live',
          }),
        })
      );
    });
  });

  describe('getQuestionById', () => {
    it('should return question with options', async () => {
      const mockQuestion = {
        id: '1',
        questionId: 'q_app_type',
        text: 'What type of application?',
        options: [{ id: 'opt1', value: 'web-app', label: 'Web Application' }],
      };

      mockPrisma.wizardQuestion.findUnique.mockResolvedValue(mockQuestion);

      const result = await service.getQuestionById('1');

      expect(result.questionId).toBe('q_app_type');
      expect(result.options).toHaveLength(1);
    });

    it('should throw NotFoundException if question not found', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue(null);

      await expect(service.getQuestionById('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createQuestion', () => {
    it('should create a question', async () => {
      const dto = {
        questionId: 'q_new',
        text: 'New question?',
        type: 'single-select',
        orderIndex: 0,
      };

      mockPrisma.wizardQuestion.findUnique.mockResolvedValue(null);
      mockPrisma.wizardQuestion.findFirst.mockResolvedValue(null);
      mockPrisma.wizardQuestion.create.mockResolvedValue({
        id: '1',
        ...dto,
        status: 'pending',
      });

      const result = await service.createQuestion(dto);

      expect(result.questionId).toBe('q_new');
      expect(result.status).toBe('pending');
    });

    it('should throw ConflictException if questionId already exists', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue({ id: '1' });

      await expect(
        service.createQuestion({
          questionId: 'existing',
          text: 'Test',
          type: 'single-select',
          orderIndex: 0,
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if entry point already exists', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue(null);
      mockPrisma.wizardQuestion.findFirst.mockResolvedValue({
        id: '1',
        questionId: 'existing_entry',
      });

      await expect(
        service.createQuestion({
          questionId: 'q_new',
          text: 'Test',
          type: 'single-select',
          orderIndex: 0,
          isEntryPoint: true,
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateQuestion', () => {
    it('should update a question', async () => {
      const mockQuestion = {
        id: '1',
        questionId: 'q_test',
        text: 'Old text',
        isEntryPoint: false,
      };

      mockPrisma.wizardQuestion.findUnique.mockResolvedValue(mockQuestion);
      mockPrisma.wizardQuestion.update.mockResolvedValue({
        ...mockQuestion,
        text: 'New text',
      });

      const result = await service.updateQuestion('1', { text: 'New text' });

      expect(result.text).toBe('New text');
    });

    it('should throw NotFoundException if question not found', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue(null);

      await expect(
        service.updateQuestion('invalid', { text: 'Test' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate questionId', async () => {
      mockPrisma.wizardQuestion.findUnique
        .mockResolvedValueOnce({ id: '1', questionId: 'q_old' })
        .mockResolvedValueOnce({ id: '2', questionId: 'q_existing' });

      await expect(
        service.updateQuestion('1', { questionId: 'q_existing' })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deleteQuestion', () => {
    it('should delete a question', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue({
        id: '1',
        questionId: 'q_test',
      });
      mockPrisma.wizardOption.findMany.mockResolvedValue([]);
      mockPrisma.wizardQuestion.delete.mockResolvedValue({});

      await service.deleteQuestion('1');

      expect(mockPrisma.wizardQuestion.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundException if question not found', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue(null);

      await expect(service.deleteQuestion('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if question is referenced', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue({
        id: '1',
        questionId: 'q_test',
      });
      mockPrisma.wizardOption.findMany.mockResolvedValue([
        { question: { questionId: 'q_other' }, value: 'opt1' },
      ]);

      await expect(service.deleteQuestion('1')).rejects.toThrow(ConflictException);
    });
  });

  describe('reorderQuestions', () => {
    it('should reorder questions', async () => {
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      await service.reorderQuestions({ questionIds: ['2', '1'] });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('createOption', () => {
    it('should create an option', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue({
        id: '1',
        questionId: 'q_test',
      });
      mockPrisma.wizardOption.findUnique.mockResolvedValue(null);
      mockPrisma.wizardOption.create.mockResolvedValue({
        id: 'opt1',
        value: 'web-app',
        label: 'Web Application',
      });

      const result = await service.createOption('1', {
        value: 'web-app',
        label: 'Web Application',
      });

      expect(result.value).toBe('web-app');
    });

    it('should throw NotFoundException if question not found', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue(null);

      await expect(
        service.createOption('invalid', { value: 'test', label: 'Test' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate value', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue({ id: '1' });
      mockPrisma.wizardOption.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createOption('1', { value: 'existing', label: 'Test' })
      ).rejects.toThrow(ConflictException);
    });

    it('should validate nextQuestionId exists', async () => {
      mockPrisma.wizardQuestion.findUnique
        .mockResolvedValueOnce({ id: '1', questionId: 'q_test' })
        .mockResolvedValueOnce(null);
      mockPrisma.wizardOption.findUnique.mockResolvedValue(null);

      await expect(
        service.createOption('1', {
          value: 'test',
          label: 'Test',
          nextQuestionId: 'invalid_question',
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent circular reference', async () => {
      mockPrisma.wizardQuestion.findUnique
        .mockResolvedValueOnce({ id: '1', questionId: 'q_test' })
        .mockResolvedValueOnce({ id: '1', questionId: 'q_test' });
      mockPrisma.wizardOption.findUnique.mockResolvedValue(null);

      await expect(
        service.createOption('1', {
          value: 'test',
          label: 'Test',
          nextQuestionId: 'q_test',
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateOption', () => {
    it('should update an option', async () => {
      mockPrisma.wizardOption.findUnique.mockResolvedValue({
        id: 'opt1',
        questionId: '1',
        value: 'old',
        question: { questionId: 'q_test' },
      });
      mockPrisma.wizardOption.update.mockResolvedValue({
        id: 'opt1',
        label: 'New Label',
      });

      const result = await service.updateOption('opt1', { label: 'New Label' });

      expect(result.label).toBe('New Label');
    });

    it('should throw NotFoundException if option not found', async () => {
      mockPrisma.wizardOption.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOption('invalid', { label: 'Test' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteOption', () => {
    it('should delete an option', async () => {
      mockPrisma.wizardOption.findUnique.mockResolvedValue({ id: 'opt1' });
      mockPrisma.wizardOption.delete.mockResolvedValue({});

      await service.deleteOption('opt1');

      expect(mockPrisma.wizardOption.delete).toHaveBeenCalledWith({
        where: { id: 'opt1' },
      });
    });

    it('should throw NotFoundException if option not found', async () => {
      mockPrisma.wizardOption.findUnique.mockResolvedValue(null);

      await expect(service.deleteOption('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitForReview', () => {
    it('should submit question for review', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue({
        id: '1',
        status: 'pending',
      });
      mockPrisma.wizardQuestion.update.mockResolvedValue({
        id: '1',
        questionId: 'q_test',
        status: 'review',
      });

      const result = await service.submitForReview('1');

      expect(result.status).toBe('review');
    });

    it('should throw ConflictException if not in pending status', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue({
        id: '1',
        status: 'live',
      });

      await expect(service.submitForReview('1')).rejects.toThrow(ConflictException);
    });
  });

  describe('approve', () => {
    it('should approve question', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue({
        id: '1',
        status: 'review',
      });
      mockPrisma.wizardQuestion.update.mockResolvedValue({
        id: '1',
        questionId: 'q_test',
        status: 'live',
      });

      const result = await service.approve('1');

      expect(result.status).toBe('live');
    });

    it('should throw ConflictException if not in review status', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue({
        id: '1',
        status: 'pending',
      });

      await expect(service.approve('1')).rejects.toThrow(ConflictException);
    });
  });

  describe('getDecisionTree', () => {
    it('should return decision tree with edges', async () => {
      mockPrisma.wizardQuestion.findMany.mockResolvedValue([
        {
          id: '1',
          questionId: 'q_app_type',
          options: [
            { id: 'opt1', value: 'web', label: 'Web', nextQuestionId: 'q_cloud' },
          ],
        },
        {
          id: '2',
          questionId: 'q_cloud',
          options: [
            { id: 'opt2', value: 'aws', label: 'AWS', nextQuestionId: null },
          ],
        },
      ]);

      const result = await service.getDecisionTree();

      expect(result.questions).toHaveLength(2);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]).toEqual({
        from: 'q_app_type',
        to: 'q_cloud',
        label: 'Web',
      });
    });
  });

  describe('testFlow', () => {
    it('should simulate flow and aggregate triggers', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue({
        questionId: 'q_cloud',
        text: 'Which cloud?',
        options: [
          {
            value: 'aws',
            triggers: {
              addBoundaries: [{ name: 'AWS Cloud', ref: 'cloud', type: 'network' }],
              setProperties: { cloudProvider: 'aws' },
            },
          },
        ],
      });

      const result = await service.testFlow({
        answers: [{ questionId: 'q_cloud', selectedValue: 'aws' }],
      });

      expect(result.boundaries).toHaveLength(1);
      expect(result.globalProperties.cloudProvider).toBe('aws');
      expect(result.path).toHaveLength(1);
    });

    it('should throw BadRequestException for invalid question', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue(null);

      await expect(
        service.testFlow({
          answers: [{ questionId: 'invalid', selectedValue: 'test' }],
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid option', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue({
        questionId: 'q_test',
        options: [{ value: 'option1' }],
      });

      await expect(
        service.testFlow({
          answers: [{ questionId: 'q_test', selectedValue: 'invalid_option' }],
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkImport', () => {
    it('should import questions with options', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          wizardQuestion: {
            create: jest.fn().mockResolvedValue({ id: '1' }),
          },
          wizardOption: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        });
      });

      const result = await service.bulkImport({
        questions: [
          {
            questionId: 'q_new',
            text: 'New question?',
            type: 'single-select',
            orderIndex: 0,
            options: [
              { value: 'opt1', label: 'Option 1' },
              { value: 'opt2', label: 'Option 2' },
            ],
          },
        ],
      });

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
    });

    it('should skip existing questions', async () => {
      mockPrisma.wizardQuestion.findUnique.mockResolvedValue({ id: '1' });

      const result = await service.bulkImport({
        questions: [
          {
            questionId: 'existing',
            text: 'Existing question',
            type: 'single-select',
            orderIndex: 0,
          },
        ],
      });

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      mockPrisma.wizardQuestion.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3)  // pending
        .mockResolvedValueOnce(2)  // review
        .mockResolvedValueOnce(5)  // live
        .mockResolvedValueOnce(6)  // single-select
        .mockResolvedValueOnce(2)  // multi-select
        .mockResolvedValueOnce(1)  // text
        .mockResolvedValueOnce(1)  // toggle
        .mockResolvedValueOnce(1)  // entry points
        .mockResolvedValueOnce(2); // terminal

      mockPrisma.wizardQuestion.findMany.mockResolvedValue([
        { questionId: 'q1' },
        { questionId: 'q2' },
      ]);
      mockPrisma.wizardOption.findMany.mockResolvedValue([
        { nextQuestionId: 'q1' },
      ]);

      const result = await service.getStats();

      expect(result.totalQuestions).toBe(10);
      expect(result.byStatus.pending).toBe(3);
      expect(result.byStatus.live).toBe(5);
      expect(result.entryPoints).toBe(1);
      expect(result.orphanedQuestions).toBe(1); // q2 is not referenced
    });
  });

  describe('getQuestionTypes', () => {
    it('should return question types', async () => {
      const result = await service.getQuestionTypes();

      expect(result).toContain('single-select');
      expect(result).toContain('multi-select');
      expect(result).toContain('text');
      expect(result).toContain('toggle');
    });
  });

  describe('getConditionOperators', () => {
    it('should return condition operators', async () => {
      const result = await service.getConditionOperators();

      expect(result).toContain('equals');
      expect(result).toContain('not_equals');
      expect(result).toContain('in');
    });
  });
});

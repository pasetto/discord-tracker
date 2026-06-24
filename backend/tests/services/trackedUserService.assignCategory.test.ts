import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const memberCategoryModelMocks = vi.hoisted(() => ({
  findOne: vi.fn(),
}));

const trackedUserModelMocks = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
}));

vi.mock('../../src/db/models/MemberCategory', () => ({
  MemberCategoryModel: {
    findOne: memberCategoryModelMocks.findOne,
  },
}));

vi.mock('../../src/db/models/TrackedUser', () => ({
  TrackedUserModel: {
    findOneAndUpdate: trackedUserModelMocks.findOneAndUpdate,
  },
}));

import { assignTrackedUserCategory } from '../../src/services/trackedUserService';

describe('assignTrackedUserCategory', () => {
  beforeEach(() => {
    memberCategoryModelMocks.findOne.mockReset();
    trackedUserModelMocks.findOneAndUpdate.mockReset();
  });

  it('atribui categoria válida ao membro rastreado', async () => {
    const organizationId = new Types.ObjectId().toHexString();
    const guildId = 'guild-1';
    const trackedUserId = new Types.ObjectId().toHexString();
    const categoryId = new Types.ObjectId().toHexString();

    memberCategoryModelMocks.findOne.mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: categoryId }),
      }),
    });

    trackedUserModelMocks.findOneAndUpdate.mockReturnValue({
      lean: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({
          _id: trackedUserId,
          discordId: '123',
          username: 'user',
          displayName: 'User',
          categoryId: new Types.ObjectId(categoryId),
          lastSeenAt: new Date(),
        }),
      }),
    });

    const result = await assignTrackedUserCategory(organizationId, guildId, trackedUserId, categoryId);

    expect(result.categoryId).toBe(categoryId);
    expect(trackedUserModelMocks.findOneAndUpdate).toHaveBeenCalled();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';

enum CaseStatus {
  REPORTED = 1,
  UNDER_REVIEW = 2,
  VERIFIED = 3,
  REJECTED = 4,
}

type FinalCaseStatus = CaseStatus.VERIFIED | CaseStatus.REJECTED;

interface Case {
  id: number;
  metadata: string;
  status: CaseStatus;
  reportedBy: string;
  reviewedBy?: string;
}

interface State {
  admin: string;
  reporters: Set<string>;
  reviewers: Set<string>;
  cases: Map<number, Case>;
  nextCaseId: number;
}

let state: State;

const STATUS = CaseStatus;

const resetState = () => {
  state = {
    admin: 'admin.test',
    reporters: new Set(['reporter.test']),
    reviewers: new Set(['reviewer.test']),
    cases: new Map(),
    nextCaseId: 1,
  };
};

// ========== Helper Functions ==========

const ensureAdmin = (sender: string) => {
  if (sender !== state.admin) throw new Error('ERR-NOT-ADMIN');
};

const ensureReporter = (sender: string) => {
  if (!state.reporters.has(sender)) throw new Error('ERR-NOT-REPORTER');
};

const ensureReviewer = (sender: string) => {
  if (!state.reviewers.has(sender)) throw new Error('ERR-NOT-REVIEWER');
};

// ========== Mock Contract Functions ==========

const submitCase = (sender: string, metadata: string): number => {
  ensureReporter(sender);
  if (!metadata.length) throw new Error('ERR-EMPTY-METADATA');
  const id = state.nextCaseId++;
  const newCase: Case = {
    id,
    metadata,
    status: STATUS.REPORTED,
    reportedBy: sender,
  };
  state.cases.set(id, newCase);
  return id;
};

const markUnderReview = (sender: string, caseId: number): void => {
  ensureReviewer(sender);
  const existing = state.cases.get(caseId);
  if (!existing) throw new Error('ERR-CASE-NOT-FOUND');
  if (existing.status !== STATUS.REPORTED) throw new Error('ERR-INVALID-STATE');
  state.cases.set(caseId, {
    ...existing,
    status: STATUS.UNDER_REVIEW,
    reviewedBy: sender,
  });
};

const finalizeCase = (sender: string, caseId: number, status: number): void => {
  ensureReviewer(sender);
  if (status !== STATUS.VERIFIED && status !== STATUS.REJECTED)
    throw new Error('ERR-INVALID-FINAL-STATUS');

  const existing = state.cases.get(caseId);
  if (!existing) throw new Error('ERR-CASE-NOT-FOUND');
  if (existing.status !== STATUS.UNDER_REVIEW) throw new Error('ERR-INVALID-STATE');
  state.cases.set(caseId, {
    ...existing,
    status: status as FinalCaseStatus,
  });
};

const updateCase = (sender: string, caseId: number, newMetadata: string): void => {
  const existing = state.cases.get(caseId);
  if (!existing) throw new Error('ERR-CASE-NOT-FOUND');
  if (existing.reportedBy !== sender) throw new Error('ERR-NOT-OWNER');
  if (existing.status !== STATUS.REPORTED) throw new Error('ERR-ALREADY-REVIEWED');
  state.cases.set(caseId, {
    ...existing,
    metadata: newMetadata,
  });
};

const transferAdmin = (sender: string, newAdmin: string): void => {
  ensureAdmin(sender);
  state.admin = newAdmin;
};

// ========== Tests ==========

describe('Case Reporter Contract Logic', () => {
  const reporter = 'reporter.test';
  const reviewer = 'reviewer.test';
  const outsider = 'outsider.test';

  beforeEach(() => {
    resetState();
  });

  it('allows a reporter to submit a valid case', () => {
    const caseId = submitCase(reporter, 'Case A');
    const c = state.cases.get(caseId)!;
    expect(c.metadata).toBe('Case A');
    expect(c.status).toBe(STATUS.REPORTED);
  });

  it('throws if metadata is empty', () => {
    expect(() => submitCase(reporter, '')).toThrow('ERR-EMPTY-METADATA');
  });

  it('allows a reviewer to mark a case under review', () => {
    const caseId = submitCase(reporter, 'Case A');
    markUnderReview(reviewer, caseId);
    const c = state.cases.get(caseId)!;
    expect(c.status).toBe(STATUS.UNDER_REVIEW);
    expect(c.reviewedBy).toBe(reviewer);
  });

  it('throws if reviewer tries to mark an already reviewed case', () => {
    const caseId = submitCase(reporter, 'Case A');
    markUnderReview(reviewer, caseId);
    expect(() => markUnderReview(reviewer, caseId)).toThrow('ERR-INVALID-STATE');
  });

  it('allows reviewer to finalize case with verified status', () => {
    const caseId = submitCase(reporter, 'Case A');
    markUnderReview(reviewer, caseId);
    finalizeCase(reviewer, caseId, STATUS.VERIFIED);
    expect(state.cases.get(caseId)!.status).toBe(STATUS.VERIFIED);
  });

  it('throws if final status is not VERIFIED or REJECTED', () => {
    const caseId = submitCase(reporter, 'Final check');
    markUnderReview(reviewer, caseId);
    expect(() => finalizeCase(reviewer, caseId, 0)).toThrow('ERR-INVALID-FINAL-STATUS');
  });

  it('allows reporter to update case before review', () => {
    const caseId = submitCase(reporter, 'Draft A');
    updateCase(reporter, caseId, 'Updated A');
    expect(state.cases.get(caseId)!.metadata).toBe('Updated A');
  });

  it('prevents reporter from updating reviewed case', () => {
    const caseId = submitCase(reporter, 'Draft A');
    markUnderReview(reviewer, caseId);
    expect(() => updateCase(reporter, caseId, 'Changed')).toThrow('ERR-ALREADY-REVIEWED');
  });

  it('prevents non-reporters from submitting a case', () => {
    expect(() => submitCase(outsider, 'Bad')).toThrow('ERR-NOT-REPORTER');
  });

  it('allows admin to transfer ownership', () => {
    transferAdmin('admin.test', 'new-admin.test');
    expect(state.admin).toBe('new-admin.test');
  });
});

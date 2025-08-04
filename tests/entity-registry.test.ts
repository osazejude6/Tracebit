import { describe, it, expect, beforeEach } from "vitest"

type Entity = {
  entityType: string
  riskScore: number
  metadata: string
  addedBy: string
  timestamp: number
}

type Ok<T> = { value: T }
type Err = { error: number }
type Result<T> = Ok<T> | Err

const isOk = <T>(result: Result<T>): result is Ok<T> => 'value' in result
const isErr = <T>(result: Result<T>): result is Err => 'error' in result

const mockRegistry = {
  admin: "ST1ADMIN...",
  blockHeight: 100,
  entities: new Map<string, Entity>(),

  isAdmin(caller: string): boolean {
    return caller === this.admin
  },

  incrementBlock() {
    this.blockHeight += 1
  },

  transferAdmin(caller: string, newAdmin: string): Result<boolean> {
    if (!this.isAdmin(caller)) return { error: 100 }
    if (newAdmin === "SP000000000000000000002Q6VF78") return { error: 104 }
    this.admin = newAdmin
    return { value: true }
  },

  addEntity(
    caller: string,
    wallet: string,
    type: string,
    risk: number,
    metadata: string
  ): Result<boolean> {
    if (!this.isAdmin(caller)) return { error: 100 }
    if (wallet === "SP000000000000000000002Q6VF78") return { error: 104 }
    if (this.entities.has(wallet)) return { error: 101 }

    this.entities.set(wallet, {
      entityType: type,
      riskScore: risk,
      metadata,
      addedBy: caller,
      timestamp: this.blockHeight,
    })
    return { value: true }
  },

  updateEntity(
    caller: string,
    wallet: string,
    risk: number,
    metadata: string
  ): Result<boolean> {
    if (!this.isAdmin(caller)) return { error: 100 }
    const existing = this.entities.get(wallet)
    if (!existing) return { error: 102 }

    this.entities.set(wallet, {
      entityType: existing.entityType,
      riskScore: risk,
      metadata,
      addedBy: existing.addedBy,
      timestamp: this.blockHeight,
    })
    return { value: true }
  },

  removeEntity(caller: string, wallet: string): Result<boolean> {
    if (!this.isAdmin(caller)) return { error: 100 }
    if (!this.entities.has(wallet)) return { error: 102 }
    this.entities.delete(wallet)
    return { value: true }
  },

  getEntity(wallet: string): Result<Entity> {
    const entity = this.entities.get(wallet)
    return entity ? { value: entity } : { error: 102 }
  },
}

describe("Tracebit Entity Registry", () => {
  const admin = "ST1ADMIN..."
  const wallet1 = "ST2ABC123..."
  const wallet2 = "ST3XYZ456..."

  beforeEach(() => {
    mockRegistry.admin = admin
    mockRegistry.blockHeight = 100
    mockRegistry.entities = new Map()
  })

  it("should allow admin to add an entity", () => {
    const result = mockRegistry.addEntity(admin, wallet1, "scam", 85, "known phishing contract")
    expect(result).toEqual({ value: true })

    const entity = mockRegistry.getEntity(wallet1)
    expect(isOk(entity)).toBe(true)
    if (isOk(entity)) {
      expect(entity.value.riskScore).toBe(85)
      expect(entity.value.metadata).toBe("known phishing contract")
    }
  })

  it("should not allow non-admin to add entity", () => {
    const result = mockRegistry.addEntity(wallet2, wallet1, "mixer", 60, "Uniswap fork")
    expect(result).toEqual({ error: 100 })
  })

  it("should update entity data", () => {
    mockRegistry.addEntity(admin, wallet1, "exchange", 20, "trusted")
    mockRegistry.incrementBlock()

    const updateResult = mockRegistry.updateEntity(admin, wallet1, 10, "updated metadata")
    expect(updateResult).toEqual({ value: true })

    const updated = mockRegistry.getEntity(wallet1)
    expect(isOk(updated)).toBe(true)
    if (isOk(updated)) {
      expect(updated.value.riskScore).toBe(10)
      expect(updated.value.metadata).toBe("updated metadata")
    }
  })

  it("should remove an entity", () => {
    mockRegistry.addEntity(admin, wallet1, "wallet", 5, "normal address")
    const result = mockRegistry.removeEntity(admin, wallet1)
    expect(result).toEqual({ value: true })

    const afterDelete = mockRegistry.getEntity(wallet1)
    expect(afterDelete).toEqual({ error: 102 })
  })

  it("should allow admin transfer", () => {
    const result = mockRegistry.transferAdmin(admin, wallet2)
    expect(result).toEqual({ value: true })
    expect(mockRegistry.admin).toBe(wallet2)
  })
})

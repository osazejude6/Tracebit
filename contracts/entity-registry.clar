;; Tracebit Entity Registry Contract
;; Clarity v2

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-ENTITY-EXISTS u101)
(define-constant ERR-ENTITY-NOT-FOUND u102)
(define-constant ERR-INVALID-TYPE u103)
(define-constant ERR-ZERO-ADDRESS u104)

(define-constant MAX-METADATA-SIZE u200)

(define-data-var admin principal tx-sender)

(define-map entities
  principal
  {
    entity-type: (string-ascii 32),
    risk-score: uint,
    metadata: (string-ascii MAX-METADATA-SIZE),
    added-by: principal,
    timestamp: uint
  }
)

;; Private Helper
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

(define-private (ensure-not-zero (p principal))
  (asserts! (not (is-eq p 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
)

;; Admin: Transfer Admin Rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (ensure-not-zero new-admin)
    (var-set admin new-admin)
    (ok true)
  )
)

;; Add new entity
(define-public (add-entity (wallet principal) (entity-type (string-ascii 32)) (risk-score uint) (metadata (string-ascii MAX-METADATA-SIZE)))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (ensure-not-zero wallet)
    (asserts! (is-none (map-get? entities wallet)) (err ERR-ENTITY-EXISTS))
    (map-set entities wallet {
      entity-type: entity-type,
      risk-score: risk-score,
      metadata: metadata,
      added-by: tx-sender,
      timestamp: block-height
    })
    (ok true)
  )
)

;; Update metadata or risk score
(define-public (update-entity (wallet principal) (new-risk uint) (new-metadata (string-ascii MAX-METADATA-SIZE)))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (ensure-not-zero wallet)
    (match (map-get? entities wallet)
      some-entity
        (begin
          (map-set entities wallet {
            entity-type: (get entity-type some-entity),
            risk-score: new-risk,
            metadata: new-metadata,
            added-by: (get added-by some-entity),
            timestamp: block-height
          })
          (ok true)
        )
      (err ERR-ENTITY-NOT-FOUND)
    )
  )
)

;; Remove an entity
(define-public (remove-entity (wallet principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (ensure-not-zero wallet)
    (asserts! (is-some (map-get? entities wallet)) (err ERR-ENTITY-NOT-FOUND))
    (map-delete entities wallet)
    (ok true)
  )
)

;; Read-only: Get entity
(define-read-only (get-entity (wallet principal))
  (match (map-get? entities wallet)
    some-entity (ok some-entity)
    (err ERR-ENTITY-NOT-FOUND)
  )
)

;; Read-only: Is registered
(define-read-only (is-registered (wallet principal))
  (ok (is-some (map-get? entities wallet)))
)

;; Read-only: Admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

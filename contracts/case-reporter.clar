;; Tracebit - Case Reporter Contract
;; Description: Handles decentralized case reporting, status tracking, and access control.
;; Version: 1.0

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-CASE-NOT-FOUND u101)
(define-constant ERR-CALLER-NOT-REPORTER u102)
(define-constant ERR-INVALID-STATUS u103)
(define-constant ERR-ALREADY-REVIEWED u104)
(define-constant ERR-INVALID-METADATA u105)

(define-constant STATUS-REPORTED u0)
(define-constant STATUS-UNDER-REVIEW u1)
(define-constant STATUS-VERIFIED u2)
(define-constant STATUS-REJECTED u3)

(define-constant MAX-METADATA-SIZE u512)

(define-data-var admin principal tx-sender)
(define-map reporters principal bool)
(define-map reviewers principal bool)

(define-map cases uint 
  {
    reporter: principal,
    status: uint,
    metadata: (string-ascii MAX-METADATA-SIZE),
    reviewed-by: (optional principal)
  }
)

(define-data-var next-case-id uint u1)

;; Private helpers
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

(define-private (ensure-admin)
  (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
)

(define-private (ensure-reporter)
  (asserts! (is-eq (default-to false (map-get? reporters tx-sender)) true) (err ERR-CALLER-NOT-REPORTER))
)

(define-private (ensure-reviewer)
  (asserts! (is-eq (default-to false (map-get? reviewers tx-sender)) true) (err ERR-NOT-AUTHORIZED))
)

;; Admin: Set new admin
(define-public (transfer-admin (new-admin principal))
  (begin
    (ensure-admin)
    (var-set admin new-admin)
    (ok true)
  )
)

;; Admin: Register/unregister reporters
(define-public (set-reporter (account principal) (enabled bool))
  (begin
    (ensure-admin)
    (map-set reporters account enabled)
    (ok enabled)
  )
)

;; Admin: Register/unregister reviewers
(define-public (set-reviewer (account principal) (enabled bool))
  (begin
    (ensure-admin)
    (map-set reviewers account enabled)
    (ok enabled)
  )
)

;; Reporter: Submit new case
(define-public (submit-case (metadata (string-ascii MAX-METADATA-SIZE)))
  (begin
    (ensure-reporter)
    (asserts! (> (len metadata) u0) (err ERR-INVALID-METADATA))
    (let ((case-id (var-get next-case-id)))
      (map-set cases case-id {
        reporter: tx-sender,
        status: STATUS-REPORTED,
        metadata: metadata,
        reviewed-by: none
      })
      (var-set next-case-id (+ case-id u1))
      (ok case-id)
    )
  )
)

;; Reviewer: Mark as under review
(define-public (mark-under-review (case-id uint))
  (begin
    (ensure-reviewer)
    (let ((case (map-get? cases case-id)))
      (match case
        some case-data
          (begin
            (asserts! (is-none (get reviewed-by case-data)) (err ERR-ALREADY-REVIEWED))
            (map-set cases case-id (merge case-data {
              status: STATUS-UNDER-REVIEW,
              reviewed-by: (some tx-sender)
            }))
            (ok true)
          )
        none (err ERR-CASE-NOT-FOUND)
      )
    )
  )
)

;; Reviewer: Finalize case with status
(define-public (finalize-case (case-id uint) (final-status uint))
  (begin
    (ensure-reviewer)
    (asserts! (or (is-eq final-status STATUS-VERIFIED) (is-eq final-status STATUS-REJECTED)) (err ERR-INVALID-STATUS))
    (let ((case (map-get? cases case-id)))
      (match case
        some case-data
          (begin
            (map-set cases case-id (merge case-data {
              status: final-status
            }))
            (ok true)
          )
        none (err ERR-CASE-NOT-FOUND)
      )
    )
  )
)

;; Reporter: Update metadata (if not reviewed)
(define-public (update-case (case-id uint) (new-metadata (string-ascii MAX-METADATA-SIZE)))
  (begin
    (ensure-reporter)
    (let ((case (map-get? cases case-id)))
      (match case
        some case-data
          (begin
            (asserts! (is-eq (get reporter case-data) tx-sender) (err ERR-CALLER-NOT-REPORTER))
            (asserts! (is-none (get reviewed-by case-data)) (err ERR-ALREADY-REVIEWED))
            (map-set cases case-id (merge case-data {
              metadata: new-metadata
            }))
            (ok true)
          )
        none (err ERR-CASE-NOT-FOUND)
      )
    )
  )
)

;; Read-only: get case by ID
(define-read-only (get-case (case-id uint))
  (match (map-get? cases case-id)
    some case (ok case)
    none (err ERR-CASE-NOT-FOUND)
  )
)

;; Read-only: get current admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if reporter
(define-read-only (is-reporter (account principal))
  (ok (default-to false (map-get? reporters account)))
)

;; Read-only: check if reviewer
(define-read-only (is-reviewer (account principal))
  (ok (default-to false (map-get? reviewers account)))
)

;; Read-only: get total case count
(define-read-only (get-case-count)
  (ok (- (var-get next-case-id) u1))
)

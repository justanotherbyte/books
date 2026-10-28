#!/bin/sh
# Smoke test against a running dev server: auth gate, upload, and R2 range streaming.
# Usage: sh scripts/smoke.sh <file.pdf> [base-url] [password]
set -eu
PDF=$1
BASE=${2:-http://localhost:4321}
PASS=${3:-books}
JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT
fail() { echo "FAIL: $1"; exit 1; }
code() { curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -c "$JAR" "$@"; }

[ "$(code "$BASE/api/books")" = 401 ] || fail "API open without a session"
[ "$(code -X POST -H 'Content-Type: application/json' -d '{"password":"wrong"}' "$BASE/api/login")" = 401 ] || fail "wrong password accepted"
[ "$(code -b 'session=9999999999999.deadbeef' "$BASE/api/books")" = 401 ] || fail "forged cookie accepted"
[ "$(code -X POST -H 'Content-Type: application/json' -d "{\"password\":\"$PASS\"}" "$BASE/api/login")" = 204 ] || fail "login"
[ "$(code "$BASE/api/books")" = 200 ] || fail "list after login"

ID=$(curl -s -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{"title":"Smoke test","author":"","pages":1}' "$BASE/api/books" | sed 's/.*"id":"\([^"]*\)".*/\1/')
[ "$(code -X PUT --data-binary @"$PDF" "$BASE/api/books/$ID/file")" = 200 ] || fail "upload"
SIZE=$(wc -c < "$PDF" | tr -d ' ')
HEADERS=$(curl -s -D - -o /dev/null -b "$JAR" -H 'Range: bytes=0-99' "$BASE/api/books/$ID/file")
echo "$HEADERS" | grep -q '^HTTP/1.1 206' || fail "range request did not return 206"
echo "$HEADERS" | grep -qi "^content-range: bytes 0-99/$SIZE" || fail "wrong Content-Range"
echo "$HEADERS" | grep -qi '^content-length: 100' || fail "wrong Content-Length"
[ "$(curl -s -b "$JAR" -H 'Range: bytes=0-4' "$BASE/api/books/$ID/file")" = "%PDF-" ] || fail "range body"
J='Content-Type: application/json'
curl -s -b "$JAR" -X PATCH -H "$J" -d '{"title":"Smoke test","author":"","tags":[" Smoke  tag ","smoke TAG","Other"]}' "$BASE/api/books/$ID" | grep -q '"tags":\["Smoke tag","Other"\]' || fail "tags not trimmed and de-duplicated"
curl -s -b "$JAR" "$BASE/api/books/$ID" | grep -q '"tags":\["Other","Smoke tag"\]' || fail "tags not stored"
curl -s -b "$JAR" "$BASE/api/tags" | grep -q '"name":"Smoke tag","count":1' || fail "tag counts"
[ "$(code -X POST -H "$J" -d '{"page":1,"rects":[[0.1,0.2,2,0.1]],"body":"x"}' "$BASE/api/books/$ID/notes")" = 400 ] || fail "out-of-range note rect accepted"
NOTE=$(curl -s -b "$JAR" -X POST -H "$J" -d '{"page":1,"quote":"Hello","rects":[[0.1,0.2,0.5,0.02]],"body":"first"}' "$BASE/api/books/$ID/notes" | sed 's/.*"id":"\([^"]*\)".*/\1/')
curl -s -b "$JAR" -X PATCH -H "$J" -d '{"body":"edited"}' "$BASE/api/books/$ID/notes/$NOTE" | grep -q '"body":"edited"' || fail "note edit"
curl -s -b "$JAR" "$BASE/api/books/$ID/notes" | grep -q '"rects":\[\[0.1,0.2,0.5,0.02\]\]' || fail "note rects not stored"
SID=0b6f4f7e-2c1a-4d5e-9f3a-6b7c8d9e0f12
[ "$(code -X POST -H "$J" -d '{"id":"'$SID'","page":1,"tool":"pen","color":"#18181b","width":0.004,"points":[0.1,0.2,0.3]}' "$BASE/api/books/$ID/strokes")" = 400 ] || fail "odd stroke point count accepted"
[ "$(code -X POST -H "$J" -d '{"id":"'$SID'","page":1,"tool":"pen","color":"#18181b","width":0.004,"points":[0.1,0.2,0.3,0.4]}' "$BASE/api/books/$ID/strokes")" = 201 ] || fail "stroke add"
[ "$(code -X POST -H "$J" -d '{"id":"'$SID'","page":1,"tool":"pen","color":"#18181b","width":0.004,"points":[0.1,0.2,0.3,0.4]}' "$BASE/api/books/$ID/strokes")" = 409 ] || fail "duplicate stroke id accepted"
curl -s -b "$JAR" "$BASE/api/books/$ID/strokes" | grep -q '"points":\[0.1,0.2,0.3,0.4\]' || fail "stroke points not stored"
[ "$(code -X DELETE "$BASE/api/books/$ID/strokes/$SID")" = 204 ] || fail "stroke delete"
[ "$(code -X DELETE "$BASE/api/books/$ID/strokes/$SID")" = 404 ] || fail "stroke delete twice"
[ "$(code -X DELETE "$BASE/api/books/$ID")" = 204 ] || fail "delete"
[ "$(code "$BASE/api/books/$ID/notes")" = 404 ] || fail "notes reachable after book delete"
curl -s -b "$JAR" "$BASE/api/tags" | grep -q 'Smoke tag' && fail "tags left behind after delete"
[ "$(code "$BASE/api/books/$ID")" = 404 ] || fail "book still exists after delete"
echo "OK"

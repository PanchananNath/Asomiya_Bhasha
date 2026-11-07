'use strict';
/**
 * C runtime embedded at the top of every generated program, plus the
 * standard prelude: the built-in library, written in Asomiya Bhasha itself
 * as `বাহিৰৰ কাজ` declarations mapped onto C functions.
 */

const RUNTIME_C = String.raw`/* ---- Asomiya Bhasha runtime (asb_rt) ---- */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <math.h>
#include <time.h>

#ifndef ASB_ASCII_DIGITS
#define ASB_ASCII_DIGITS 0
#endif
#ifndef ASB_RT
#if defined(__GNUC__) || defined(__clang__)
#define ASB_RT static inline __attribute__((unused))
#else
#define ASB_RT static inline
#endif
#endif

/* Write s to stdout, turning ASCII digits into Assamese digits ০-৯ (U+09E6-U+09EF). */
ASB_RT void asb_rt_put_number(const char *s) {
    for (; *s; s++) {
        if (!ASB_ASCII_DIGITS && *s >= '0' && *s <= '9') {
            char b[3] = { (char)0xE0, (char)0xA7, (char)(0xA6 + (*s - '0')) };
            fwrite(b, 1, 3, stdout);
        } else {
            putchar(*s);
        }
    }
}
ASB_RT void asb_rt_puts(const char *s) { fputs(s, stdout); }
ASB_RT void asb_rt_sp(void) { putchar(' '); }
ASB_RT void asb_rt_nl(void) { putchar('\n'); }
ASB_RT void asb_rt_print_i64(long long v) { char b[32]; snprintf(b, sizeof b, "%lld", v); asb_rt_put_number(b); }
ASB_RT void asb_rt_print_u64(unsigned long long v) { char b[32]; snprintf(b, sizeof b, "%llu", v); asb_rt_put_number(b); }
ASB_RT void asb_rt_print_f64(double v) {
    char b[64];
    if (isnan(v)) { asb_rt_puts("অসংখ্যা"); return; }
    if (isinf(v)) { asb_rt_puts(v > 0 ? "অসীম" : "-অসীম"); return; }
    snprintf(b, sizeof b, "%.15g", v);
    asb_rt_put_number(b);
}
ASB_RT void asb_rt_print_bool(bool v) { asb_rt_puts(v ? "সত্য" : "মিছা"); }
ASB_RT void asb_rt_print_char(char c) { putchar(c); }
ASB_RT void asb_rt_print_cp(int32_t cp) {
    unsigned char b[4]; int n;
    if (cp < 0x80) { b[0] = (unsigned char)cp; n = 1; }
    else if (cp < 0x800) { b[0] = 0xC0 | (cp >> 6); b[1] = 0x80 | (cp & 0x3F); n = 2; }
    else if (cp < 0x10000) { b[0] = 0xE0 | (cp >> 12); b[1] = 0x80 | ((cp >> 6) & 0x3F); b[2] = 0x80 | (cp & 0x3F); n = 3; }
    else { b[0] = 0xF0 | (cp >> 18); b[1] = 0x80 | ((cp >> 12) & 0x3F); b[2] = 0x80 | ((cp >> 6) & 0x3F); b[3] = 0x80 | (cp & 0x3F); n = 4; }
    fwrite(b, 1, (size_t)n, stdout);
}
ASB_RT void asb_rt_print_str(const char *s) { asb_rt_puts(s ? s : "খালি"); }
ASB_RT void asb_rt_print_ptr(const void *p) { if (!p) asb_rt_puts("খালি"); else printf("%p", p); }

/* Input */
ASB_RT char *asb_rt_read_line_from(FILE *f) {
    size_t cap = 64, len = 0; int c = 0;
    char *buf = (char *)malloc(cap);
    if (!buf || !f) { free(buf); return NULL; }
    while ((c = fgetc(f)) != EOF && c != '\n') {
        if (len + 1 >= cap) { char *nb = (char *)realloc(buf, cap *= 2); if (!nb) { free(buf); return NULL; } buf = nb; }
        buf[len++] = (char)c;
    }
    if (c == EOF && len == 0) { free(buf); return NULL; }
    if (len && buf[len - 1] == '\r') len--;
    buf[len] = 0;
    return buf;
}
ASB_RT char *asb_rt_read_line(void) { fflush(stdout); return asb_rt_read_line_from(stdin); }
/* Copy s to out, converting Assamese digits to ASCII digits. */
ASB_RT void asb_rt_to_ascii(const char *s, char *out, size_t cap) {
    size_t k = 0;
    while (*s && k + 1 < cap) {
        const unsigned char *u = (const unsigned char *)s;
        if (u[0] == 0xE0 && u[1] == 0xA7 && u[2] >= 0xA6 && u[2] <= 0xAF) { out[k++] = (char)('0' + (u[2] - 0xA6)); s += 3; }
        else out[k++] = *s++;
    }
    out[k] = 0;
}
ASB_RT long long asb_rt_parse_i64(const char *s) { char b[128]; if (!s) return 0; asb_rt_to_ascii(s, b, sizeof b); return strtoll(b, NULL, 10); }
ASB_RT double asb_rt_parse_f64(const char *s) { char b[128]; if (!s) return 0; asb_rt_to_ascii(s, b, sizeof b); return strtod(b, NULL); }
ASB_RT long long asb_rt_read_i64(void) { char *l = asb_rt_read_line(); long long v = asb_rt_parse_i64(l); free(l); return v; }
ASB_RT double asb_rt_read_f64(void) { char *l = asb_rt_read_line(); double v = asb_rt_parse_f64(l); free(l); return v; }

/* Strings */
ASB_RT char *asb_rt_strdup(const char *s) { size_t n = strlen(s) + 1; char *p = (char *)malloc(n); if (p) memcpy(p, s, n); return p; }
ASB_RT char *asb_rt_concat(const char *a, const char *b) {
    size_t x = strlen(a), y = strlen(b); char *p = (char *)malloc(x + y + 1);
    if (!p) return NULL;
    memcpy(p, a, x); memcpy(p + x, b, y + 1);
    return p;
}
ASB_RT long long asb_rt_utf8_len(const char *s) { long long n = 0; for (; *s; s++) if (((unsigned char)*s & 0xC0) != 0x80) n++; return n; }
ASB_RT char *asb_rt_i64_to_str(long long v) {
    char b[32], *out = (char *)malloc(96), *o = out; const char *s = b;
    if (!out) return NULL;
    snprintf(b, sizeof b, "%lld", v);
    for (; *s; s++) {
        if (!ASB_ASCII_DIGITS && *s >= '0' && *s <= '9') { *o++ = (char)0xE0; *o++ = (char)0xA7; *o++ = (char)(0xA6 + (*s - '0')); }
        else *o++ = *s;
    }
    *o = 0;
    return out;
}
ASB_RT long long asb_rt_time(void) { return (long long)time(NULL); }
ASB_RT int asb_rt_fputs(FILE *f, const char *s) { return fputs(s, f); }
/* Windows: UTF-8 console and UTF-8 command-line arguments (no <windows.h> needed). */
#ifdef _WIN32
#include <wchar.h>
__declspec(dllimport) wchar_t *__stdcall GetCommandLineW(void);
__declspec(dllimport) wchar_t **__stdcall CommandLineToArgvW(const wchar_t *cmd, int *n);
__declspec(dllimport) int __stdcall WideCharToMultiByte(unsigned int cp, unsigned long flags, const wchar_t *w, int wn, char *s, int sn, const char *def, int *used);
__declspec(dllimport) int __stdcall SetConsoleOutputCP(unsigned int cp);
__declspec(dllimport) int __stdcall SetConsoleCP(unsigned int cp);
#endif
ASB_RT void asb_rt_init(int *argc, char ***argv) {
#ifdef _WIN32
    int n = 0, i;
    wchar_t **w;
    SetConsoleOutputCP(65001);
    SetConsoleCP(65001);
    w = CommandLineToArgvW(GetCommandLineW(), &n);
    if (w && n > 0) {
        char **u = (char **)calloc((size_t)n + 1, sizeof(char *));
        if (!u) return;
        for (i = 0; i < n; i++) {
            int len = WideCharToMultiByte(65001, 0, w[i], -1, NULL, 0, NULL, NULL);
            u[i] = (char *)malloc(len > 0 ? (size_t)len : 1);
            if (!u[i]) return;
            if (len <= 0 || !WideCharToMultiByte(65001, 0, w[i], -1, u[i], len, NULL, NULL)) u[i][0] = 0;
        }
        *argc = n;
        *argv = u;
    }
#else
    (void)argc; (void)argv;
#endif
}
/* ---- end of runtime ---- */
`;

const PRELUDE = String.raw`
# অসমীয়া ভাষা ২.০ — মানক পুথিভঁৰাল (standard library)
# Input / output
বাহিৰৰ কাজ ছপা(বাক্য ধৰণ, ...) -> পূৰ্ণ = "printf"
বাহিৰৰ কাজ পঢ়া() -> বাক্য = "asb_rt_read_line"
বাহিৰৰ কাজ পঢ়া_পূৰ্ণ() -> পূ৬৪ = "asb_rt_read_i64"
বাহিৰৰ কাজ পঢ়া_দশমিক() -> দশমিক = "asb_rt_read_f64"
বাহিৰৰ কাজ সংখ্যালৈ(বাক্য) -> পূ৬৪ = "asb_rt_parse_i64"
বাহিৰৰ কাজ দশমিকলৈ(বাক্য) -> দশমিক = "asb_rt_parse_f64"
বাহিৰৰ কাজ বাক্যলৈ(পূ৬৪) -> বাক্য = "asb_rt_i64_to_str"
# Memory
বাহিৰৰ কাজ সংৰক্ষণ(ধ৬৪) -> শূন্য* = "malloc"
বাহিৰৰ কাজ পুনৰ_সংৰক্ষণ(শূন্য*, ধ৬৪) -> শূন্য* = "realloc"
বাহিৰৰ কাজ মুকলি(শূন্য*) = "free"
বাহিৰৰ কাজ প্ৰতিলিপি(শূন্য*, শূন্য*, ধ৬৪) -> শূন্য* = "memcpy"
বাহিৰৰ কাজ ভৰোৱা(শূন্য*, পূৰ্ণ, ধ৬৪) -> শূন্য* = "memset"
# Strings
বাহিৰৰ কাজ বাক্য_দৈৰ্ঘ্য(বাক্য) -> পূ৬৪ = "strlen"
বাহিৰৰ কাজ তুলনা(বাক্য, বাক্য) -> পূৰ্ণ = "strcmp"
বাহিৰৰ কাজ বাক্য_প্ৰতিলিপি(বাক্য) -> বাক্য = "asb_rt_strdup"
বাহিৰৰ কাজ যোগ_বাক্য(বাক্য, বাক্য) -> বাক্য = "asb_rt_concat"
বাহিৰৰ কাজ আখৰ_সংখ্যা(বাক্য) -> পূ৬৪ = "asb_rt_utf8_len"
# Mathematics (দশমিক)
বাহিৰৰ কাজ বৰ্গমূল(দশমিক) -> দশমিক = "sqrt"
বাহিৰৰ কাজ ঘাত(দশমিক, দশমিক) -> দশমিক = "pow"
বাহিৰৰ কাজ পৰম(দশমিক) -> দশমিক = "fabs"
বাহিৰৰ কাজ ছাইন(দশমিক) -> দশমিক = "sin"
বাহিৰৰ কাজ কছাইন(দশমিক) -> দশমিক = "cos"
বাহিৰৰ কাজ টেন(দশমিক) -> দশমিক = "tan"
বাহিৰৰ কাজ লগ(দশমিক) -> দশমিক = "log"
বাহিৰৰ কাজ লগ১০(দশমিক) -> দশমিক = "log10"
বাহিৰৰ কাজ তল(দশমিক) -> দশমিক = "floor"
বাহিৰৰ কাজ ওপৰ(দশমিক) -> দশমিক = "ceil"
বাহিৰৰ কাজ ঘূৰণীয়া(দশমিক) -> দশমিক = "round"
# Process, time and random numbers
বাহিৰৰ কাজ প্ৰস্থান(পূৰ্ণ) = "exit"
বাহিৰৰ কাজ যাদৃচ্ছিক() -> পূৰ্ণ = "rand"
বাহিৰৰ কাজ বীজ(ধ৩২) = "srand"
বাহিৰৰ কাজ সময়() -> পূ৬৪ = "asb_rt_time"
# Files
বাহিৰৰ কাজ খোলা(বাক্য পথ, বাক্য ধৰণ) -> ফাইল* = "fopen"
বাহিৰৰ কাজ বন্ধ(ফাইল*) -> পূৰ্ণ = "fclose"
বাহিৰৰ কাজ ফাইলত_লিখা(ফাইল*, বাক্য) -> পূৰ্ণ = "asb_rt_fputs"
বাহিৰৰ কাজ ফাইলত_ছপা(ফাইল*, বাক্য ধৰণ, ...) -> পূৰ্ণ = "fprintf"
বাহিৰৰ কাজ ফাইলৰ_শাৰী(ফাইল*) -> বাক্য = "asb_rt_read_line_from"
`;

/** C library functions already declared by the headers the runtime includes. */
const HEADER_SYMBOLS = new Set(('printf fprintf sprintf snprintf puts fputs putchar getchar fgets fopen fclose fread fwrite fflush ' +
    'malloc calloc realloc free exit abort atoi atol strtol strtoll strtod rand srand qsort bsearch abs labs llabs system getenv ' +
    'strlen strcmp strncmp strcpy strncpy strcat strncat strchr strrchr strstr memcpy memmove memset memcmp ' +
    'sqrt pow fabs sin cos tan asin acos atan atan2 exp log log10 log2 floor ceil round fmod hypot time clock').split(' '));

/** The runtime as a separate C file with external linkage (linked with LLVM-built programs). */
function runtimeLibrary(opts = {}) {
    return `/* অসমীয়া ভাষা runtime — LLVM back end-ৰ বাবে */\n#define ASB_ASCII_DIGITS ${opts.asciiDigits ? 1 : 0}\n#define ASB_RT\n${RUNTIME_C}`;
}

module.exports = { RUNTIME_C, PRELUDE, HEADER_SYMBOLS, runtimeLibrary };

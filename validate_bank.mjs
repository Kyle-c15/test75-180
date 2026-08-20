import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./questions.js", import.meta.url), "utf8");
const context = { window: {} };
vm.runInNewContext(source, context, { filename: "questions.js" });
const questions = context.window.QUESTION_BANK;
const errors = [];
const ids = new Set();
const stems = new Set();
const pageCounts = new Map();
const answerPositions = new Map([[0, 0], [1, 0], [2, 0], [3, 0]]);

if (!Array.isArray(questions) || questions.length === 0) errors.push("题库不是非空数组");
for (const question of questions) {
  if (!question.id || ids.has(question.id)) errors.push(`ID 不唯一或为空: ${question.id}`);
  ids.add(question.id);
  if (!question.stem || stems.has(question.stem)) errors.push(`题干重复或为空: ${question.id}`);
  if (question.stem.length > 50) errors.push(`题干过长: ${question.id}`);
  stems.add(question.stem);
  if (!/^PDF \d+（印刷页 \d+）$/.test(question.source)) errors.push(`来源页格式错误: ${question.id}`);
  if (!Array.isArray(question.options) || question.options.length !== 4 || question.options.some((option) => typeof option !== "string" || !option.trim()) || new Set(question.options).size !== 4) {
    errors.push(`选项必须为4个非空不重复文本: ${question.id}`);
  }
  if (question.options.some((option) => option.length > 40)) errors.push(`选项过长: ${question.id}`);
  if (question.options.some((option) => option.includes("…"))) errors.push(`选项含截断省略号: ${question.id}`);
  if (!Array.isArray(question.answer) || question.type === "single" && question.answer.length !== 1 || question.type === "multiple" && question.answer.length < 2) {
    errors.push(`答案结构错误: ${question.id}`);
  }
  if (!question.answer.every((index) => Number.isInteger(index) && index >= 0 && index < 4)) errors.push(`答案下标越界: ${question.id}`);
  if (!question.explanation || question.explanation.length < 12) errors.push(`解析过短: ${question.id}`);
  if (question.explanation.length > 120) errors.push(`解析过长: ${question.id}`);
  const sourcePage = Number(question.source.match(/^PDF (\d+)/)[1]);
  if (sourcePage < 1 || sourcePage > 106) errors.push(`来源页越界: ${question.id}`);
  pageCounts.set(sourcePage, (pageCounts.get(sourcePage) || 0) + 1);
  if (question.type === "single") answerPositions.set(question.answer[0], answerPositions.get(question.answer[0]) + 1);
}

const missingPages = Array.from({ length: 106 }, (_, index) => index + 1).filter((page) => !pageCounts.has(page));
if (missingPages.length) errors.push(`无题页面: ${missingPages.join(",")}`);
const minPageCount = Math.min(...pageCounts.values());
if (minPageCount < 10) errors.push(`单页题量低于10题: ${minPageCount}`);
const total = questions.length;
const multiple = questions.filter((question) => question.type === "multiple").length;
const single = total - multiple;
const counts = Object.fromEntries(answerPositions);
const spread = Math.max(...Object.values(counts)) - Math.min(...Object.values(counts));
if (spread > Math.ceil(single * 0.08)) errors.push(`单选正确答案位置过度集中: ${JSON.stringify(counts)}`);

console.log(JSON.stringify({ total, single, multiple, pages: pageCounts.size, minPageCount, maxPageCount: Math.max(...pageCounts.values()), answerPositions: counts, duplicateStems: total - stems.size, errors: errors.length }, null, 2));
if (errors.length) {
  console.error(errors.slice(0, 30).join("\n"));
  process.exit(1);
}

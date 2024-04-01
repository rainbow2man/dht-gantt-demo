/**
 * 将 数组 转换成 树
 * @param {*} list
 * @returns
 */
export function arrFormatToTree(list) {
  const tempTree = {};

  list.forEach((item) => {
    const { id, parent } = item;

    if (!tempTree[id]) {
      tempTree[id] = { ...item, children: [] };
    } else {
      tempTree[id] = { ...tempTree[id], ...item };
    }

    if (!tempTree[parent]) {
      tempTree[parent] = { children: [] };
    }
  });

  const tree = [];
  for (const id in tempTree) {
    const item = tempTree[id];
    const parentId = item.parent;
    if (tempTree[parentId]) {
      tempTree[parentId].children.push(item);
    } else {
      tree.push(item);
    }
  }

  return tree;
}

/**
 * 将 树型数据 转换为 下拉框选择数据
 * @param {*} options
 * @param {*} list
 * @param {*} id
 * @param {*} field
 */
export function treeFormatToOptions(options, list, id, field) {
  list.forEach((item) => {
    if (String(item.id) === String(id)) return;
    const temp = {
      value: item.id ? String(item.id) : 0, // 将 id 转 string 是因为业务需求，在甘特图这里，后端保存的是 字符串，但是 甘特图组件自己生成的是 数字，这里不处理成 字符串，会导致找不到对应的下拉框选择数据
      label: item[field] || "无",
      showCode: item.showCode
    };

    options.push(temp);

    if (item.children) {
      treeFormatToOptions(options, item.children, id, field);
    }
  });
}

// 根据精度 确定需要增加的数值
export function generateNumber(precision) {
  const num = 1 / 10 ** precision;
  return Number(num.toFixed(precision));
}

// 延迟 开始日期，如果是 周末则跳到周一，TODO: 之后支持跳过节假日，跳到节假日后的第一个工作日
export function delayStartDate(startDate) {
  const tempDate = new Date(startDate);

  while (tempDate.getDay() === 0 || tempDate.getDay() === 6) {
    tempDate.setDate(tempDate.getDate() + 1);
  }

  return tempDate;
}

// 延迟 子代的开始日期，duration 为与父级开始日期的 工作日天数差值
export function delayChildStartDate(parentStart, duration) {
  // 设置一个 新变量，让其不污染 parentStart
  const tempDate = new Date(parentStart);

  // 循环遍历工作日
  for (let i = 0; i < duration; i += 1) {
    // 增加一天并跳过周末
    tempDate.setDate(tempDate.getDate() + 1);

    // 如果当前日期是周末，则跳过
    while (tempDate.getDay() === 0 || tempDate.getDay() === 6) {
      tempDate.setDate(tempDate.getDate() + 1);
    }
  }

  return tempDate;
}

// 往回查找开始日期
export function reBackStartDate(endDate, duration) {
  const tempDate = new Date(endDate);

  // 循环遍历工作日
  for (let i = 0; i < duration; i += 1) {
    // 增加一天并跳过周末
    tempDate.setDate(tempDate.getDate() - 1);

    // 如果当前日期是周末，则跳过
    while (tempDate.getDay() === 0 || tempDate.getDay() === 6) {
      tempDate.setDate(tempDate.getDate() - 1);
    }
  }

  return tempDate;
}

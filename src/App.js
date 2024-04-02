import "dhtmlx-gantt/codebase/skins/dhtmlxgantt_material.css";
import "./styles.less";
import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
// import moment from "moment";
import dayjs from "dayjs";
import { gantt } from "dhtmlx-gantt";
import { Button, Modal, Form, message, Menu, Dropdown, Divider } from "antd";
import BigNumber from "bignumber.js";
import { originColumns, operationMenu } from "./config";
import {
  arrFormatToTree,
  treeFormatToOptions,
  generateNumber,
  reBackStartDate,
  delayChildStartDate,
  delayStartDate,
} from "./utils";
import mockData from "./mockData";
import ModalFormItem from "./components/modal-form-item";
import { cloneDeep } from "lodash";

//拆分的组件
import RenderZoomPicker from "./components/zoom-picker/RenderZoomPicker.tsx";
import AddOrEditTaskModel from "./components/add-or-edit-task-model/index.tsx";
//表单内 grid栅栏 的配置
const formItemLayout = {
  labelCol: {
    span: 6,
  },
  wrapperCol: {
    span: 16,
  },
};

export default function App(props) {
  const [visible, setVisible] = useState(false);
  const [curTask, setCurTask] = useState({});
  const [broIndex, setBroIndex] = useState(0);
  const [maxCount, setMaxCount] = useState();
  const [addType, setAddType] = useState("");

  const ganttContainer = useRef();
  const _ZoomComnponent = useRef();
  // 用于给新增任务做标识的
  const _uuid = useRef(1);
  const _treeMap = useRef({}); // 记录记录树的父级包含的子级顺序的映射
  const formref = useRef();
  const codeMap = useRef({});
  const deleteList = useRef([]);
  const _targetMap = useRef({});
  const _sourceMap = useRef({});

  useEffect(() => {
    // 注册修改新增弹出框（建立一种关系，具体怎么唤起的不清楚）
    registerLightBox();
    // gantt 基本配置
    setGanttConfig();
    //在任务栏中显示今日时间标识线
    setDateMarker();
    //配置 表头标题信息 以及点击+弹出的下拉框信息
    setColumns();
    setTaskDrag();
    setLinkChange();

    // 获取格式化后的数据
    const formatData = formatTask();
    //初始化甘特图
    gantt.init(ganttContainer.current);
    //加载数据
    gantt.parse(formatData);
  }, []);

  //PASS 将数据处理成我们需要的集合
  function formatTask() {
    const tempData = mockData;
    const taskTree = {};
    const tempLinks = [];

    tempData.data.forEach((item) => {
      const temp = { ...item };

      // 如果 外部的开始日期和结束日期都有值，更新成 0 点即可
      const startDate = new Date(`${temp.start_date} 00:00:00`);
      temp.start_date = startDate;
      const endDate = new Date(`${temp.end_date} 00:00:00`);
      endDate.setDate(endDate.getDate() + 1); // 在渲染页面的时候 结束日期 + 1天
      temp.end_date = endDate;
      //处理任务状态
      const status = temp.progress === 1 ? "finish" : "continue";
      temp.task_status = status;

      //如果当前节点没有父节点，new一个并push进数据作为父级节点，适用第一层循环时
      if (!taskTree[temp.parent]) {
        taskTree[temp.parent] = [];
      }
      taskTree[temp.parent].push(temp);

      //如果有前置任务,获取前后任务的id，拼接成连接，push进主数据
      if (item.pre_task) {
        const source = item.pre_task;
        const target = item.id;
        const lag = item.lag;
        // 拼接出link对象
        const link = {
          id: `${source}-${target}`,
          type: "0",
          source,
          target,
          lag,
        };
        tempLinks.push(link);

        //useref link的头尾作为映射，存进ref中，后续会在视图操作时的拖动/连接的各种限制判断中用到，比如不可以a节点拖拽到a节点，
        _targetMap.current[target] = link;
        _sourceMap.current[source] = link;
      }
    });

    _treeMap.current = cloneDeep(taskTree);

    // 设置 codeMap
    const tempCodeMap = {
      0: {
        code: null,
        count: taskTree[0]?.length,
      },
    };
    const newList = [];
    formatCodeMap(taskTree[0], null, taskTree, tempCodeMap, newList);
    //所有的节点code 以及子节点的数量

    codeMap.current = { ...tempCodeMap };
    tempData.data = newList;
    tempData.links = tempLinks;

    return tempData;
  }

  //PASS 处理 任务成 codeMap（如果新增或者修改了 更新code/showcode）
  function formatCodeMap(
    items,
    parentCode,
    tree,
    tempCodeMap,
    newList,
    level = 0
  ) {
    if (!items) return;
    // 将 子代任务进行排序
    items.sort((a, b) => {
      return a.code - b.code;
    });

    // 遍历排序好的 子代，然后赋编号code
    items.forEach((item, index) => {
      const { id } = item;
      //拼接新的showcode  如果有 父级code，生成新的 code 为 父级code.父级子任务数量 比如：1.2 2.4
      const code = parentCode
        ? `${parentCode}.${index + 1}`
        : String(index + 1);
      item.showCode = code;
      // 增加这三行 带$的属性 是为了 让甘特图新增完任务重排的时候顺序不乱
      item.$index = index;
      item.$level = level;
      if (broIndex) item.$rendered_parent = item.parent;

      // 将更新了 code 的 item 传出去更新
      newList.push(item);

      // 如果 tree[item.id] 存在，即为 该任务有子代，继续遍历
      if (tree[item.id]) {
        tempCodeMap[id] = {
          count: tree[item.id].length,
          code,
        };

        formatCodeMap(
          tree[item.id],
          code,
          tree,
          tempCodeMap,
          newList,
          level + 1
        );
      } else {
        tempCodeMap[id] = {
          count: 0,
          code,
        };
      }
    });
  }

  //PASS 注册自定义 任务修改/新增弹出框
  function registerLightBox() {
    console.log("注册自定义 任务修改/新增弹出框");

    // 打开 弹出框事件
    gantt.showLightbox = (id) => {
      const task = gantt.getTask(id);
      const store = gantt.getDatastore("task");
      // 给其任务的子级 计算开始日期之间的工作日天数的差值
      calcOffsetDuration(id);

      // 获取 当前所有任务，临时拼接成树后，再转为筛掉自己和子级的 下拉框选项
      // 该下拉框选项 用于选择 父任务
      const taskList = Object.values(store.pull);
      const taskTree = arrFormatToTree(taskList);
      const taskOptions = [];
      treeFormatToOptions(taskOptions, taskTree, id, "text");

      originColumns.forEach((item) => {
        if (item.originField === "parent") {
          // 如果 task 有任务链接，需要筛选一下，让选择的父任务不能选其后置任务
          let options = taskOptions;
          const sourceLink = _sourceMap.current[task.id];
          if (sourceLink) {
            const { target } = sourceLink;
            options = taskOptions.filter((cur) => cur.value !== target);
          }
          // 将 下拉框数据根据 showCode 进行排序
          handleSortOptions(options);
          item.options = options;
        } else if (item.originField === "pre_task") {
          item.options = taskOptions.slice(1); // 选择前置任务时需要删除第一位的 root
        }
      });

      // 让 status 与 进度保持一直
      if (task.progress === 1) {
        task.task_status = "finish";
      } else {
        task.task_status = "continue";
      }

      // 获取 当前任务的 code
      const map = codeMap.current;
      const { parent } = task;
      let { showCode } = task;

      // 如果 当前任务 是新建的，需要设置一个 默认code
      // 如果在根目录下，则直接 code = 根目录任务count + 1
      // 如果在某个任务下，则 code = 父任务code + 父任务子代count + 1
      if (task.$new) {
        showCode =
          parent === 0
            ? String(map[0].count + 1)
            : `${map[parent].code}.${map[parent].count + 1}`;
      }

      const tempTask = {
        ...task,
        showCode,
        parent: parent === 0 ? 0 : String(parent), // dhtmlx 会默认给 parent 为数字 0，但我们需要 字符串0，需要手动转一下
      };

      const date = new Date();
      date.setTime(task.end_date.getTime());

      // 打开模态框时，如果结束时间 比 开始时间大时 要 减一天
      if (task.end_date.getTime() > task.start_date.getTime()) {
        date.setTime(task.end_date.getTime() - 24 * 60 * 60 * 1000);
      }

      tempTask.end_date = date;

      // 计算 持续时间的最大值
      handleCalcMax(tempTask);

      // 设置默认值
      setCurTask(tempTask);
      setVisible(true);
      gantt.resetLayout(); // 重置表格 布局，即新建任务的时候，可以看到新建的任务
    };

    // 关闭 弹出框事件
    gantt.hideLightbox = () => {
      setVisible(false);
      setMaxCount();
    };
  }

  //PASS 给其任务的子级 计算开始日期之间的工作日天数的差值
  function calcOffsetDuration(id) {
    const task = gantt.getTask(id);

    gantt.eachTask((child) => {
      const offsetDur = gantt.calculateDuration(
        task.start_date,
        child.start_date
      );

      child.offsetDur = offsetDur;
    }, id);

    return true;
  }

  //PASS 将下拉框数据根据 showCode 进行排序
  function handleSortOptions(list) {
    list.sort((a, b) => {
      // 如果存在有数据没有 showCode 时候往前放
      if (!a.showCode) return -1;
      if (!b.showCode) return 1;

      // showCode 为 1\1.1\1.1.1 这样的，所以需要把他们通过 . 切割一下
      const aArray = String(a.showCode).split(".");
      const bArray = String(b.showCode).split(".");

      // 最后逐层比较
      for (let i = 0; i < Math.max(aArray.length, bArray.length); i += 1) {
        const aValue = parseInt(aArray[i], 10) || 0;
        const bValue = parseInt(bArray[i], 10) || 0;
        if (aValue !== bValue) {
          return aValue - bValue;
        }
      }
      return 0;
    });
  }

  //PASS 计算 任务持续时间最大值 和根任务的完成时间挂钩
  function handleCalcMax(task) {
    console.log("表格更新，触发最大持续时间更新");
    const record = { ...(task || curTask) };

    // 如果该任务为根任务，则不需要有最大值的限制
    if (!record.parent) {
      setMaxCount();
      return undefined;
    }

    // 获取父任务的结束日期
    const parentTask = gantt.getTask(record.parent);
    const parentEndDate = new Date(parentTask.end_date);

    // 计算出 过滤了周末的 持续时间，即为 持续时间的最大值
    const startDate = new Date(record.start_date);
    const diffDay = gantt.calculateDuration(startDate, parentEndDate);

    setMaxCount(Number(diffDay));
    return Number(diffDay);
  }

  //PASS 设置甘特图的 基础配置
  function setGanttConfig() {
    gantt.config.row_height = 32;
    gantt.config.date_format = "%Y-%m-%d %H:%i";
    gantt.i18n.setLocale("cn");
    // x/y轴完全显示，不会出现滚动条
    gantt.config.autosize = "y";
    // 开启 工作日记录
    gantt.config.work_time = true;

    gantt.locale.labels.new_task = "新任务";
    // gantt.config.start_date = new Date(2000, 8, 1);
    // gantt.config.end_date = new Date(2099, 8, 20);

    gantt.config.layout = {
      css: "gantt_container",
      cols: [
        {
          width: 400,
          min_width: 300,
          rows: [
            {
              view: "grid",
              scrollX: "gridScroll",
              scrollable: true,
              scrollY: "scrollVer",
            },
            { view: "scrollbar", id: "gridScroll", group: "horizontal" },
          ],
        },
        //大小调整线 pro限定
        // { resizer: true, width: 1 }
        {
          rows: [
            { view: "timeline", scrollX: "scrollHor", scrollY: "scrollVer" },
            { view: "scrollbar", id: "scrollHor", group: "horizontal" },
          ],
        },
        { view: "scrollbar", id: "scrollVer" },
      ],
    };
    // 可以进行排序
    gantt.config.order_branch = "marker";
    // 允许分支排序
    gantt.config.order_branch_free = false;

    gantt.plugins({
      marker: true,
    });

    // 设置 甘特图 时间列的 class 类名，用于配置禁用日期的样式
    gantt.templates.timeline_cell_class = (task, date) => {
      // console.log("_ZoomComnponent", _ZoomComnponent.current._curZoom);
      const disableHighlight = ["month", "year", "quarter"].includes(
        //获取子节点的当前时间刻度变量
        _ZoomComnponent.current._curZoom
      );
      // 设置禁用周末的功能 及样式
      if (!disableHighlight && !gantt.isWorkTime(date)) return "week_end";
      return "";
    };

    // 设置 任务的 class 类名，用于配置 任务完成时的 样式
    gantt.templates.task_class = (start, end, task) => {
      if (task.progress === 1) return "completed_task";
      return "";
    };

    // 任务移动后的回调事件
    // 挂载回调事件
    gantt.attachEvent("onrender", (id, parent, tindex) => {
      newUpdateSortCode(id, parent, tindex);
    });

    // 配置 固定写死无需理解 可以让表格渲染 用 react 组件
    gantt.config.external_render = {
      // checks the element is a React element
      isElement: (element) => {
        return React.isValidElement(element);
      },
      // renders the React element into the DOM
      renderElement: (element, container) => {
        ReactDOM.render(element, container);
      },
    };
  }

  //PASS 设置 时间标识线
  function setDateMarker() {
    const dateToStr = gantt.date.date_to_str(gantt.config.task_date);
    const today = new Date(new Date().setHours(0, 0, 0, 0)); // 获取当天零点的时间
    gantt.addMarker({
      start_date: today,
      css: "today",
      text: "今日",
      title: `Today: ${dateToStr(today)}`,
    });
  }

  //PASS 设置gantt.config.columns的配置，temp就是单个的列，
  //其中重新渲染了下拉选择类型/时间/百分比进度，以及增加列的下拉菜单点击事件
  function setColumns() {
    const tempColumns = originColumns.map((item) => {
      //从config配置的基本属性中，取出需要的属性
      const { name, originField, options, type: colType } = item;
      const temp = { ...item };

      // 如果有 原始字段，将 动态更新后的字段还原回 原始字段
      // 并将其映射关系 记录在 fieldMap 中
      // if (originField) {
      //   fieldMap.current[originField] = name;
      //   temp.name = temp.originField;
      // }

      // 通过onrender二次渲染列的内容
      // 如果是 select，在表格中展示 label 文字 比如
      if (colType === "select") {
        temp.onrender = (task, node) => {
          if (task[name]) {
            node.innerText = options.filter(
              (cur) => cur.value === task[name]
            )[0].label;
          }
        };
        //计算进度条百分比 比如 90%
      } else if (colType === "slider") {
        temp.onrender = (task, node) => {
          node.innerText = `${Math.round(task[name] * 100)}%`;
        };
      } else if (colType === "date" && originField === "end_date") {
        // 如果是 结束日期，显示需要减一天
        temp.onrender = (task, node) => {
          if (task[name]) {
            const date = dayjs(task[name]).subtract(1, "days");
            node.innerText = date.format("YYYY-MM-DD");
          }
        };
      }

      // 当列是增加列时， 渲染下拉 menu 组件
      if (name === "add") {
        temp.onrender = (task) => {
          return (
            <Dropdown
              // menu={{ operationMenu }}
              overlay={
                <Menu
                  className="operation-menu-wrapper"
                  onClick={(cur) => {
                    menuClick(cur, task);
                  }}
                >
                  {operationMenu.map((cur) => {
                    //最后一个是删除，分割线
                    if (cur.key === "delete") {
                      return (
                        <div key={cur.key}>
                          <Divider type="horizontal" />
                          <Menu.Item key={cur.key} className={cur.key}>
                            {cur.label}
                          </Menu.Item>
                        </div>
                      );
                    } else {
                      return (
                        <Menu.Item key={cur.key} className={cur.key}>
                          {cur.label}
                        </Menu.Item>
                      );
                    }
                  })}
                </Menu>
              }
            >
              <div className="add-icon"> + </div>
            </Dropdown>
          );
        };
      }

      return temp;
    });

    gantt.config.columns = tempColumns;
  }

  //PASS 下拉 menu 的 点击事件
  function menuClick(item, task) {
    console.log("下拉菜单点击事件", item, task);
    //下拉菜单得key config.js
    const { key } = item;

    const id = _uuid.current + 1;
    const tempTask = {
      id,
    };
    console.log("_uuid", _uuid.current);
    console.log("tempTask", tempTask);
    _uuid.current = id;

    console.log(
      "_treeMap",
      _treeMap.current[task.parent].findIndex((cur) => cur.id === task.id)
    );
    const index = _treeMap.current[task.parent].findIndex(
      (cur) => cur.id === task.id
    );

    // 点击 新建本级时
    if (key === "add-bro") {
      // 创建任务，在当前任务的下一个位置
      gantt.createTask(
        tempTask,
        task.parent !== 0 ? task.parent : undefined,
        index + 1
      );
      setAddType("bro");
      setBroIndex(index + 1);
    } else if (key === "add-child") {
      // 点击 新建子级时
      gantt.createTask(tempTask, task.id);
      setAddType("child");
    } else if (key === "delete") {
      // 点击删除时，弹出提示框
      showDeleteConfirm(task);
    }
  }

  // 设置 父子任务一起拖拽 以及 拖拽范围
  function setTaskDrag() {
    // 在拖拽前 获取 其与其子级开始日期的差值
    gantt.attachEvent("onBeforeTaskDrag", calcOffsetDuration);

    // 这一个 方法是 限制拖拽范围，因为他底层 应该是做了 类似 eventListener 之类的操作，所以可以写两个方法，差分开来显得清晰
    gantt.attachEvent("onTaskDrag", (id, mode, task) => {
      // 获取 parent
      const parent =
        task.parent && task.parent !== 0 ? gantt.getTask(task.parent) : null;
      const modes = gantt.config.drag_mode;

      // 限制开始日期和结束日期的方法
      let limitLeft = null;
      let limitRight = null;

      // 如果 拖拽的是 进度
      if (mode === modes.progress) {
        // setDynFieldValue(task, 'progress', task.progress);
        gantt.updateTask(task.id, task);
      }

      // 如果不是拖动和修改范围 则 return
      if (!(mode === modes.move || mode === modes.resize)) return;

      // 根据 Mode 设置限制范围的方法
      if (mode === modes.move) {
        limitLeft = limitMoveLeft;
        limitRight = limitMoveRight;
        const startDate = new Date(task.start_date);
        const endDate = gantt.calculateEndDate(startDate, task.duration);

        task.start_date = startDate;
        task.end_date = endDate;
        // setDynFieldValue(task, 'start_date', startDate);
        // setDynFieldValue(task, 'end_date', endDate);
      } else if (mode === modes.resize) {
        limitLeft = limitResizeLeft;
        limitRight = limitResizeRight;
      }

      // 将 parent 与 自己做判断
      // +Date 为快速转换为 时间戳的方式
      if (parent && +parent.end_date < +task.end_date) {
        limitLeft(task, parent);
      }
      if (parent && +parent.start_date > +task.start_date) {
        limitRight(task, parent);
      }

      return true;
    });

    // 这一个方法 是用来 父子一起拖动的
    gantt.attachEvent("onTaskDrag", (id, mode, task) => {
      const modes = gantt.config.drag_mode;
      const children = gantt.getChildren(id);

      // 当父级移动时
      if (mode === modes.move) {
        // 遍历所有子级
        gantt.eachTask((child) => {
          const { offsetDur, duration } = child;
          // 子级的开始日期为 父级开始日期 + 与父级开始日期的偏移量
          const startDate = new Date(+task.start_date + offsetDur * 86400000);
          // 子级的结束日期为 开始日期 + 持续时间，这里不重算休息日 是因为最后会重算
          const endDate = new Date(+startDate + duration * 86400000);

          // 设置子级数据并更新
          child.start_date = startDate;
          child.end_date = endDate;
          // setDynFieldValue(child, 'start_date', startDate);
          // setDynFieldValue(child, 'end_date', endDate);

          gantt.refreshTask(child.id, true);
        }, id);
      } else if (mode === modes.resize) {
        // 当父级修改范围时
        // 去获取子级的范围，父级无法缩小过子级的范围
        for (let i = 0; i < children.length; i += 1) {
          const child = gantt.getTask(children[i]);
          if (+task.end_date < +child.end_date) {
            limitResizeLeft(task, child);
          } else if (+task.start_date > +child.start_date) {
            limitResizeRight(task, child);
          }
        }
      }

      return true;
    });

    // 拖拽完成后的 回调事件
    gantt.attachEvent("onAfterTaskDrag", (id, mode) => {
      const modes = gantt.config.drag_mode;
      // 获取 任务 和 父级
      const task = gantt.getTask(id);
      const parent =
        task.parent && task.parent !== 0 ? gantt.getTask(task.parent) : null;

      if (mode === modes.move) {
        // 如果 开始时间到节假日 延迟到下一个工作日
        const newStartDate = delayStartDate(task.start_date);
        const newEndDate = gantt.calculateEndDate(newStartDate, task.duration);
        task.start_date = newStartDate;
        task.end_date = newEndDate;
        // setDynFieldValue(task, 'start_date', newStartDate);
        // setDynFieldValue(task, 'end_date', newEndDate);

        // 如果父级存在，那么在拖动完后，进行重算时，不能超过父级的范围
        if (parent && +parent.start_date > +task.start_date) {
          limitMoveRight(task, parent);
        }
        if (parent && +parent.end_date < +task.end_date) {
          limitMoveLeft(task, parent);
        }

        // 遍历所有子级
        gantt.eachTask((child) => {
          // 限制 任务子级的 开始日期和结束日期
          controlChildLimit(child, task, newStartDate);
        }, id);
      } else if (mode === modes.resize) {
        const newStartDate = delayStartDate(task.start_date);
        const newEndDate = gantt.calculateEndDate(newStartDate, task.duration);
        task.start_date = newStartDate;
        task.end_date = newEndDate;
        // setDynFieldValue(task, 'start_date', newStartDate);
        // setDynFieldValue(task, 'end_date', newEndDate);
      }

      // 当任务拖拽更改后 只要不是新增的 就增加 edit 标识
      if (!task.isNew) {
        task.isEdit = true;
      }
      gantt.updateTask(task.id, task);
      updateTreeMapItem(task.parent, task.id, task);
      return true;
    });
  }

  // 设置 link 链接变动的时候的 回调函数
  function setLinkChange() {
    // 链接添加后的回调事件
    gantt.attachEvent("onAfterLinkAdd", (id, link) => {
      const { target, source } = link;
      const newId = `${source}-${target}`;
      // 查找 targetMap 看该任务 存不存在 已有的链接
      const targetLink = _targetMap.current[target];
      const sourceLink = _targetMap.current[source];
      const nowLink = gantt.getLink(id);

      // 查找 来源节点的 link，如果 来源link的 source 等于 当前 target 时，代表任务循环引用了
      if (sourceLink && sourceLink?.source === target) {
        // 不一致且存在链接的时候，不允许他拖拽上
        if (nowLink) {
          gantt.deleteLink(id);
          message.warning(
            "任务之间不能循环引用，该任务的前置任务不能是其后置任务！"
          );
          return true;
        }
      } else if (targetLink) {
        // 看一下是否和当前的 来源是否不一致 或 链接的来源为 这次的目标，这即为循环引用，不允许
        if (targetLink.source !== source) {
          // 不一致且存在链接的时候，不允许他拖拽上
          if (nowLink) {
            gantt.deleteLink(id);
            message.warning(
              "该任务已有前置任务，如需关联，请先删除该任务的关联关系！"
            );
          }
        } else if (id !== newId) {
          // 如果来源一致，即有可能重复链接了
          if (nowLink) {
            gantt.deleteLink(id);
            message.warning("该任务已链接此前置任务，无需再关联一次！");
          }
        }
      } else {
        // 如果不存在
        // 更新 新增好的 Link 的 id
        const newLink = { ...link, id: newId };
        _targetMap.current[target] = newLink;
        _sourceMap.current[source] = newLink;
        gantt.changeLinkId(id, newId);

        // 然后更新 目标组件
        const targetTask = gantt.getTask(target);
        targetTask.pre_task = String(source);
        // setDynFieldValue(targetTask, 'pre_task', String(source));

        targetTask.isEdit = true;
        gantt.updateTask(targetTask.id, targetTask);
        updateTreeMapItem(targetTask.parent, targetTask.id, targetTask);
      }

      console.log(_targetMap.current, "targetMap");
      return true;
    });

    // 链接删除后的回调函数
    gantt.attachEvent("onAfterLinkDelete", (id, item) => {
      const { target, source } = item;
      const newId = `${source}-${target}`;
      const preLink = _targetMap.current[target];

      // 如果 targetMap 中存在这个 link，并且 这个 id 是我们拼接好的 id，不是组件自己生成的 id 时 才去删掉
      if (preLink?.source === source && id === newId) {
        // 将其删掉
        delete _targetMap.current[target];
        delete _sourceMap.current[source];

        // 找到 link 指到的目标任务
        // 将该任务的 前置任务清空
        const targetTask = gantt.getTask(target);
        targetTask.pre_task = undefined;
        // setDynFieldValue(targetTask, 'pre_task', undefined);

        targetTask.isEdit = true;
        gantt.updateTask(targetTask.id, targetTask);
        updateTreeMapItem(targetTask.parent, targetTask.id, targetTask);
      }
    });
  }

  // 更新 treeMap 里的数据
  function updateTreeMapItem(parentId, id, task) {
    const list = _treeMap.current[parentId];
    const index = list.findIndex((item) => item.id === id);

    if (index >= 0) {
      list[index] = { ...list[index], ...task };
    }
  }

  // 渲染 模态框的 表单列表
  function renderFormList() {
    const list = [];

    //循环config.js中的originColumns，渲染单行表单项
    originColumns.forEach((item) => {
      const { name, label, type: itemType, originField, required } = item;

      const component = (
        <Form.Item
          key={item.name}
          {...formItemLayout}
          name={originField || name}
          label={label}
          rules={
            required
              ? [{ required: true, message: `${label}字段为必输项` }]
              : null
          }
        >
          {/*渲染表单项内容 */}
          {renderFormItem(item)}
        </Form.Item>
      );

      if (itemType) {
        list.push(component);
      }
    });

    return list;
  }

  // PASS 渲染 表单项当行
  function renderFormItem(item) {
    return (
      //进入组件选择器
      <ModalFormItem
        gantt={gantt}
        curTask={curTask}
        formref={formref}
        //父组件的结束时间-开始时间 即为最大的持续时间
        durationMax={maxCount}
        // item.type决定了当前显示的是哪个组件
        config={item}
        afterBlur={() => {}}
        disabled={item.type === "codingRule" || item.name === "showCode"}
        // disabledDate={disabledDate}
        // fieldMap={fieldMap}
      />
    );
  }

  // 任务模态框 表单值一旦更新，修改开始结束时间需要同步修改持续时间，修改进度需要修改状态
  function handleFormChange(value, allValue) {
    console.log("打开模态框触发的表单值更新");
    // console.log(value, allValue, 'value, allValue')
    // 如果 开始日期 或 持续时间 的值变动了，需要更新 结束日期
    if (value.start_date || value.duration) {
      // eslint-disable-next-line camelcase
      const { start_date } = allValue;
      let { duration } = allValue;

      // 如果这次更新的时 start_date, 需要重新计算 duration 的上限
      if (value.start_date) {
        const durationLimit = handleCalcMax(allValue);

        // 当 duration 上限存在 并且 duration 大于上限时， duration 等于上线
        if (durationLimit && duration > durationLimit) {
          duration = durationLimit;
        }

        // 更新 duration
        formref.current.setFieldsValue({
          duration,
        });
      }

      const endDate = gantt.calculateEndDate(new Date(start_date), duration);
      endDate.setDate(endDate.getDate() - 1); // 联动更新完 结束日期要减一

      formref.current.setFieldsValue({
        end_date: endDate,
      });
    } else if (value.progress) {
      // 进度和状态更改了，都要去修改另一项
      const status = value.progress === 1 ? "finish" : "continue";
      formref.current.setFieldsValue({
        task_status: status,
      });
    } else if (value.task_status) {
      const progress = value.task_status === "finish" ? 1 : 0;
      formref.current.setFieldsValue({
        progress,
      });
    } else if (value.parent) {
      if (value.parent === 0) {
        setMaxCount();
      } else {
        const parentTask = gantt.getTask(value.parent);
        const parentEndDate = new Date(parentTask.end_date);
        parentEndDate.setDate(parentEndDate.getDate() - 1);
        const tempTask = { ...curTask, ...allValue };

        // 如果 任务 不在父任务的范围内
        if (
          !(
            allValue.end_date <= parentEndDate &&
            allValue.start_date >= parentTask.start_date
          )
        ) {
          // 如果 任务原本的持续时间 大于 父任务的持续时间，任务的持续时间改为与父任务相等
          if (tempTask.duration > parentTask.duration) {
            tempTask.duration = parentTask.duration;
          }

          // 获取父级的 startDate 并计算 任务修改到父任务日期范围内后的 endDate
          const startDate = parentTask.start_date;
          const endDate = gantt.calculateEndDate(startDate, tempTask.duration);
          endDate.setDate(endDate.getDate() - 1);

          // 重新更新 开始和结束日期
          tempTask.start_date = startDate;
          tempTask.end_date = endDate;

          formref.current.setFieldsValue(tempTask);
        }

        handleCalcMax(tempTask);
      }
    }
  }

  // 渲染 模态框底部
  function renderFooter() {
    return (
      <div className="task-modal-footer">
        <div className="footer-left">
          {/* <Popconfirm
            title='任务将被永久删除，确认吗？'
            onConfirm={() => { handleModalDelete() }}
          >
            <Button type="danger">删除</Button>
          </Popconfirm> */}
        </div>
        <div className="footer-right">
          <Button onClick={handleModalCancel}>取消</Button>
          <Button type="primary" onClick={handleModalSubmit}>
            确定
          </Button>
        </div>
      </div>
    );
  }

  //PASS 显示 删除任务时的 确定提示
  function showDeleteConfirm(task) {
    Modal.confirm({
      title: "确定删除该任务吗?",
      content: "该任务的子任务将一并被删除，请确认",
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk() {
        handleModalDelete(task);
      },
    });
  }

  // 删除 任务
  function handleModalDelete(task) {
    const tempTreeMap = { ..._treeMap.current };

    const tempTask = task || curTask;
    // 如果是 新建的任务
    if (tempTask.$new || tempTask.isNew) {
      gantt.deleteTask(tempTask.id);
    } else {
      // 将 任务记录到需要给后端
      deleteList.current.push(tempTask);

      // 如果存在子级， 子级也一起进入删除队列
      if (tempTreeMap[tempTask.id]) {
        deleteChildren(tempTreeMap[tempTask.id]);
      }
      gantt.deleteTask(tempTask.id);
    }

    // 找到 该任务的位置，并删除 treeMap 中的数据
    let originIndex = 0;
    tempTreeMap[tempTask.parent].forEach((item, index) => {
      if (item.id === tempTask.id) {
        originIndex = index;
      }
    });
    tempTreeMap[tempTask.parent].splice(originIndex, 1);
    _treeMap.current = { ...tempTreeMap };

    // 更新所有任务 以及 生成新的 codeMap
    updateCodeMapAndTask(tempTreeMap);

    setVisible(false);
    setMaxCount();
    setCurTask({});
  }

  // 删除子级，将子级记录进删除队列中
  function deleteChildren(list) {
    list.forEach((item) => {
      deleteList.current.push(item);

      if (_treeMap.current[item.id]) {
        deleteChildren(_treeMap.current[item.id]);
      }
    });
  }

  // 取消编辑或新建 任务
  function handleModalCancel() {
    if (curTask.$new) {
      gantt.deleteTask(curTask.id);
    }
    setVisible(false);
    setMaxCount();
    setCurTask({});
  }

  // 保存 走 表单校验
  function handleModalSubmit() {
    formref.current.submit();
  }

  // 新增 修改 任务保存
  function handleModalSave(formValue) {
    // const formValue = formref.current.getFieldsValue();
    // console.log(formValue, 'formValue')

    // 保存的时候将 父级处理回 字符串，这样才能重新映射回 甘特图组件上
    // formValue.parent = formValue.parent.value;

    const isNewFlag = curTask.isNew || curTask.$new;

    const newTask = {
      ...curTask,
      ...formValue,
      isNew: isNewFlag,
      isEdit: !isNewFlag,
    };

    // 当有 dayjs 对象时 转为 date 对象
    Object.keys(newTask).forEach((key) => {
      if (dayjs.isDayjs(newTask[key])) {
        newTask[key] = newTask[key].toDate();
        // newTask[map[key]] = newTask[key];
        // setDynFieldValue(newTask, key, newTask[key].toDate());
      }
    });

    // 获取任务的原始父级
    const originParent = curTask.parent;
    const { parent } = newTask;

    // 计算 tindex 如果为新增本级，那么就是之前存的 broIndex, 如果是添加子级，直接用子级长度作为 index
    const parentLength = _treeMap.current[parent]?.length;
    const tindex = parentLength
      ? addType === "bro"
        ? broIndex
        : parentLength
      : 0;

    const endDate = new Date(newTask.end_date);
    endDate.setDate(endDate.getDate() + 1); // 确认任务时 结束日期加一天
    newTask.end_date = endDate;
    // setDynFieldValue(newTask, 'end_date', endDate);

    // 如果保存的任务 配置了前置任务
    if (newTask.pre_task) {
      const { id, pre_task: preTask } = newTask;
      // 设置 link
      const tempLink = {
        id: `${preTask}-${id}`,
        source: preTask,
        target: id,
        type: "0",
      };

      // 如果 targetMap 中不存在，直接 添加 link
      if (!_targetMap.current[id]) {
        _targetMap.current[id] = tempLink;
        _sourceMap.current[preTask] = tempLink;
        gantt.addLink(tempLink);
      } else {
        // 如果 targetMap 中存在
        const preLink = _targetMap.current[id];

        // 看一下存的 source 是否和 当前前置任务一致，不一致的时候
        if (preLink.source !== preTask) {
          gantt.deleteLink(preLink.id);
          _targetMap.current[id] = tempLink;
          _sourceMap.current[preTask] = tempLink;
          gantt.addLink(tempLink);
          newTask.pre_task = preTask;
          // setDynFieldValue(newTask, 'pre_task', preTask);
        }
      }
    } else {
      // 如果保存的任务 没有配置前置任务
      const { id, pre_task: preTask } = newTask;
      const preLink = _targetMap.current[id];

      // 查看是否存在于  targetMap 中，如果存在，即这次为清空前置任务，需要删掉 link
      if (_targetMap.current[id]) {
        gantt.deleteLink(preLink.id);
        delete _targetMap.current[id];
        delete _sourceMap.current[preTask];
      }
    }

    // 如果存在 $new 则代表是新建的
    if (newTask.$new) {
      delete newTask.$new;
      // 先添加任务，在重排
      gantt.addTask(newTask, parent, tindex);
      newUpdateSortCode(newTask.id, parent, tindex, newTask);
    } else {
      if (originParent !== parent) {
        newUpdateSortCode(newTask.id, parent, tindex, undefined, newTask);
      } else {
        gantt.updateTask(newTask.id, newTask);
        updateTreeMapItem(newTask.parent, newTask.id, newTask);
      }
    }

    gantt.eachTask((child) => {
      // 限制 任务子级的 开始日期和结束日期
      controlChildLimit(child, newTask, newTask.start_date);
    }, newTask.id);

    setVisible(false);
    setMaxCount();
    setAddType("");
    setBroIndex(0);
    gantt.resetLayout(); // 重置表格 布局，即新建任务的时候，可以看到新建的任务
  }

  // 新版  重排 任务用于排序的 code（隐式code 不重排，确保同级 code 唯一，然后显示code 只在前端渲染，给后端只传更改的数据）
  function newUpdateSortCode(id, parent, tindex, newTask, editTask) {
    console.log("任务被移动了。触发onrender事件");
    // 获取 全局保存的树状的 数据
    const tempTreeMap = _treeMap.current;

    // 获取它的兄弟数组
    let broList = tempTreeMap[parent] || [];
    broList = broList.sort((a, b) => {
      return a.code - b.code;
    });

    // 通过 树状数据 处理出 人物列表
    const taskList = Object.values(tempTreeMap).reduce((prev, next) => {
      return prev.concat(next);
    }, []);

    // 遍历任务列表，找到正在移动的任务 的原始数据
    let moveTask = newTask || {};
    taskList.forEach((item) => {
      if (`${item.id}` === `${id}`) {
        // eslint-disable-next-line camelcase
        // const { start_date, end_date, duration } = editTask;
        const { parent: originParent } = item;

        const tempTask = { ...item, ...editTask };
        // setDynFieldValue(tempTask, 'start_date', start_date);
        // setDynFieldValue(tempTask, 'end_date', end_date);
        // setDynFieldValue(tempTask, 'duration', duration);
        // setDynFieldValue(tempTask, 'parent', originParent);
        tempTask.parent = originParent;

        moveTask = tempTask;
      }
    });

    // 找到该任务的原始父级 和 原始的兄弟数组
    const originParent = newTask ? null : moveTask.parent;
    const originBroList = (tempTreeMap[originParent] || []).sort((a, b) => {
      return a.code - b.code;
    });

    // 并找出 移动任务在 原始兄弟数组中的 Index
    let originIndex = 0;
    originBroList.forEach((item, index) => {
      if (item.id === moveTask.id) {
        originIndex = index;
      }
    });

    // 判断 拖拽任务 拖拽前的父级 是否与 拖拽后的父级一直，并且 originIndex 是否小于 当前index
    const indexFlag = originParent === parent && originIndex < tindex;
    // 如果 indexFlag 为 true 的话 tindex 要比往常多 1，因为是同级拖拽，前面的数据一道后面时，index 不比平常多 1的话，会导致数据取的不对
    const beforeIndex = indexFlag ? tindex : tindex - 1;
    const afterIndex = indexFlag ? tindex + 1 : tindex;

    // 如果 拖拽到最后一个位置
    if (
      tindex > 0 &&
      tindex === (originParent === parent ? broList.length - 1 : broList.length)
    ) {
      console.log("插入最后");
      // 获取之前最后一个位置的 task
      const beforeTask = broList[beforeIndex];

      // 如果该 task 就是 MoveTask 则 return，会出现这个状况是因为 taskMove 会执行两次，第二次执行会让 code 混乱
      if (beforeTask.id === moveTask.id) return;

      // 获取 需要切割的 code
      // codeArr 会将 code 根据小数点切割成数组
      let codeArr = "";
      if (beforeTask.code) {
        codeArr = beforeTask.code.toString().split(".");
      } else {
        codeArr = [];
      }

      // 根据 code 小数点后的数量确定 小数精度
      const precision = codeArr[1]?.length || 0;
      // 根据小数精度，确定需要增加的 Num 量
      const preNum = generateNumber(precision);

      // 让 beforeCode 与 preNum 相加 即为 移动任务新的 code
      const moveCode = Number(
        BigNumber(beforeTask.code).plus(preNum).toString()
      );
      moveTask.code = moveCode;
    } else if (tindex > 0) {
      console.log("插入中间");
      // 如果不是在最后，并且 tindex > 0，即为在两个值之间插入了
      // 找到插入位置前一个任务 和 后一个任务
      const beforeTask = broList[beforeIndex];
      const afterTask = broList[afterIndex];

      // 如果后一个任务 就是 MoveTask 则 return，会出现这个状况是因为 taskMove 会执行两次，第二次执行会让 code 混乱
      if (afterTask.id === moveTask.id) return;

      // 分别获取 Before 和 after 任务code 切割后的文本
      const beforeCodeArr = beforeTask.code.toString().split(".");
      const afterCodeArr = afterTask.code.toString().split(".");

      // 获取 before 和 after code 的精度，去最小的，最精细的
      const beforePre = beforeCodeArr[1]?.length || 1;
      const afterPre = afterCodeArr[1]?.length || 1;
      let precision = Math.max(beforePre, afterPre);

      // 根据小数精度，确定需要增加的 Num 量
      let preNum = generateNumber(precision);
      let moveCode = 0;
      // 如果 beforeCode + preNum === afterCode 时，需要提升精度 1 级精度
      if (
        BigNumber(preNum).plus(beforeTask.code).toString() ===
        `${afterTask.code}`
      ) {
        precision += 1;
        preNum = generateNumber(precision);
      }

      // 让 beforeCode 与 preNum 相加 即为 移动任务新的 code
      moveCode = Number(BigNumber(preNum).plus(beforeTask.code).toString());
      moveTask.code = moveCode;
    } else {
      console.log("插入开头");
      // 以上两个都不满足的话，即为插入到第一个的位置
      // 查找之前在 第一个的任务，如果找不到，即为之前没有，默认为一个空数组
      const afterTask = broList[afterIndex] || {};

      // 如果后一个任务 就是 MoveTask 则 return，会出现这个状况是因为 taskMove 会执行两次，第二次执行会让 code 混乱
      if (afterTask.id === moveTask.id) return;

      // 获取 需要切割的 code
      // codeArr 会将 code 根据小数点切割成数组
      let codeArr = "";
      if (afterTask.code) {
        codeArr = afterTask.code.toString().split(".");
      } else {
        codeArr = [];
      }

      // 根据 code 小数点后的数量确定 小数精度
      const precision = codeArr[1]?.length || 0;
      // 根据小数精度，确定需要增加的 Num 量
      const preNum = generateNumber(precision + 1);
      const moveCode = Number(preNum.toFixed(precision + 1));
      moveTask.code = moveCode;
      // setDynFieldValue(moveTask, 'code', moveCode);

      // 如果之前没有 broList，需要新建一个，并且更新到 tempTreeMap 中，用于之后添加
      if (!broList.length) {
        tempTreeMap[parent] = [];
        broList = tempTreeMap[parent];
      }
    }

    // 修改 移动任务的 parent 为 当前插入的 parent，并且编辑标识改为 true
    moveTask.parent = parent;
    // setDynFieldValue(moveTask, 'parent', parent);

    // 如果 存在 父级
    if (parent && parent !== 0) {
      const parentTask = gantt.getTask(parent);

      // 当 移动的任务的持续时间 小于或等于 父级的持续时间
      if (moveTask.duration <= parentTask.duration) {
        // 如果 移动任务的开始日期 大于 父任务的开始日期 并且 小于父任务的结束日期
        // 需要计算其 与 父任务开始日期的差值
        if (
          moveTask.start_date > parentTask.start_date &&
          moveTask.start_date < parentTask.end_date
        ) {
          const offsetDur = gantt.calculateDuration(
            parentTask.start_date,
            moveTask.start_date
          );
          moveTask.offsetDur = offsetDur;
        } else {
          moveTask.offsetDur = 0;
        }

        // 限制任务的 开始结束日期
        controlChildLimit(moveTask, parentTask, parentTask.start_date, true);
      } else {
        // 当 移动的任务的持续时间 大于 父级的持续时间
        // 任务时间变成和父任务一致
        // eslint-disable-next-line camelcase
        const { start_date, end_date, duration } = parentTask;
        moveTask.start_date = start_date;
        moveTask.end_date = end_date;
        moveTask.duration = duration;
        // setDynFieldValue(moveTask, 'start_date', start_date);
        // setDynFieldValue(moveTask, 'end_date', end_date);
        // setDynFieldValue(moveTask, 'duration', duration);
      }
    }

    if (!(moveTask.isNew || moveTask.$new)) moveTask.isEdit = true;

    // 将该任务 从原本存在的数组中 删除
    if (tempTreeMap[originParent])
      tempTreeMap[originParent].splice(originIndex, 1);

    // 在 要插入的数组中添加
    broList.splice(tindex, 0, moveTask);
    _treeMap.current = tempTreeMap;

    // 更新所有任务 以及 生成新的 codeMap
    updateCodeMapAndTask(tempTreeMap);
  }

  // 更新 codeMap 以及 重排任务的显示序号
  function updateCodeMapAndTask(treeMap) {
    const newList = [];

    // 因为在 treeMap 中没有最外层的数据，所以这里初始化一个最外层的对象
    const tempCodeMap = {
      0: {
        code: null,
        count: treeMap[0]?.length,
      },
    };

    // 处理 任务成 codeMap, 并获得 更新过 code 的任务
    formatCodeMap(treeMap[0], null, treeMap, tempCodeMap, newList);
    codeMap.current = tempCodeMap;

    // 批量更新任务
    gantt.batchUpdate(() => {
      newList.forEach((item) => {
        gantt.updateTask(item.id, item);
      });
    });
    gantt.resetLayout();
  }

  // 限制 任务子级的 开始日期和结束日期
  function controlChildLimit(child, task, parentStart, noChangeFlag) {
    // 如果子级的开始时间到 节假日了，也需要往后延迟到工作日
    // 除此之外 还要和父级保持 相等的工作日天数差值
    const childStartDate = delayChildStartDate(parentStart, child.offsetDur);

    // 更新 子级任务的数据
    child.start_date = childStartDate;
    child.end_date = gantt.calculateEndDate(childStartDate, child.duration);

    // 限制子级 不超过父级的 开始日期 和 结束日期
    // if (task && +task.start_date > +child.start_date) {
    //   limitMoveRight(child, task);
    // }
    // if (task && +task.end_date < +child.end_date) {
    //   limitMoveLeft(child, task);
    // }

    // 更新任务
    child.isEdit = true;

    // 如果传了 这个参数 就不去实时更新
    // 主要是在 模态框里确定后使用的，在那里如果提前更新的话 会导致最后更新数据出现错行的问题
    if (!noChangeFlag) {
      gantt.updateTask(child.id, child);
      updateTreeMapItem(child.parent, child.id, child);
    }
  }

  // 拖拽 到父级开始节点的限制
  function limitMoveLeft(task, limit) {
    // const dur = task.end_date - task.start_date;
    const dur = gantt.calculateDuration(task.start_date, task.end_date);

    // task.end_date = new Date(limit.end_date);
    // task.start_date = new Date(+task.end_date - dur);
    const endDate = new Date(limit.end_date);
    const startDate = reBackStartDate(endDate, dur);
    task.end_date = endDate;
    task.start_date = startDate;
    // setDynFieldValue(task, 'end_date', endDate);
    // setDynFieldValue(task, 'start_date', startDate);
  }

  // 拖拽 到父级结束节点的限制
  function limitMoveRight(task, limit) {
    const dur = task.end_date - task.start_date;
    // const dur = countWeekdays(task.start_date, task.end_date) * 86400000

    task.start_date = new Date(limit.start_date);
    task.end_date = new Date(+task.start_date + dur);
    // setDynFieldValue(task, 'start_date', new Date(limit.start_date));
    // setDynFieldValue(task, 'end_date', new Date(+task.start_date + dur));
  }

  // 更改 子任务的开始时间 不能超过父任务的限制
  function limitResizeLeft(task, limit) {
    task.end_date = new Date(limit.end_date);
    // setDynFieldValue(task, 'end_date', new Date(limit.end_date));
  }

  // 更改 子任务的结束时间 不能超过父任务的限制
  function limitResizeRight(task, limit) {
    task.start_date = new Date(limit.start_date);
    // setDynFieldValue(task, 'start_date', new Date(limit.start_date));
  }

  return (
    <div className="App">
      {/* 头部视图切换栏 */}
      <RenderZoomPicker ref={_ZoomComnponent} />
      {/* 甘特图自动更新渲染 */}
      <div
        ref={function (ref) {
          ganttContainer.current = ref;
        }}
        style={{ width: "100%", height: "100%" }}
      />

      {/*  双击任务弹出模态框  */}
      {/* <Modal
        open={visible}
        onCancel={handleModalCancel}
        footer={renderFooter()}
        destroyOnClose
        title="新建/编辑任务"
        className="edit-task-modal"
      >
        <Form
          initialValues={curTask}
          onValuesChange={handleFormChange}
          onFinish={handleModalSave}
          //任务data
          ref={formref}
        >
          {renderFormList()}
        </Form>
      </Modal> */}

      <AddOrEditTaskModel visible={visible} setVisible={setVisible} />
    </div>
  );
}

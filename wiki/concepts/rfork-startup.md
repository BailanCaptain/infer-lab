---
id: rfork-startup
title: RFork 启动：准备模型以后才借 seed，失败后先清理再重建
type: feature
summary: >-
  新实例用 RFork 加载模型时，每个 Worker 先在本卡搭好模型、转好布局，再向 Planner 借
  seed、按地址读权重；借不到或读失败，先清理干净再从存储普通加载。本页按十步走一遍，讲清为什么晚申请租约、两处提前离开、回退怎样清理、三类「没有可用
  seed」，以及 GLM 双机第一次冷启动怎么走。
aliases:
  - RFork 启动
  - RFork load_model
  - RFork fallback
  - RFork late acquisition
  - RFork has no available
  - RFork fallback aborted
chapters: []
order: 30
sources:
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L414-L418'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L441-L519'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L521-L620'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L622-L710'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L174-L333'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L73-L109'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L274-L286'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/types.py#L38-L49'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L373-L383'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L103-L148'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L64-L91'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/planner_client.py#L69-L109'
  - >-
    rfork@3284850b:docs/source/developer_guide/Design_Documents/rfork_lease_lifecycle.md#L28-L52
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L39-L74'
  - 'rfork@3284850b:examples/rfork/rfork_planner.py#L192-L212'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L38-L57'
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/session.py#L296-L347'
  - 'rfork@3284850b:vllm_ascend/ops/fused_moe/fused_moe.py#L508-L511'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/model_loader/rfork/rfork_loader.py#L219-L320
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/model_loader/rfork/rfork_loader.py#L214-L315
  - >-
    vllm-ascend@baa023ad:vllm_ascend/model_loader/rfork/rfork_loader.py#L330-L440
  - 'rfork@3284850b:vllm_ascend/model_loader/rfork/transfer_backend.py#L189-L217'
  - >-
    raw:sha256-b55b32722cce760cf460a51943536138061f6322f2cac46d335a5c783df5da72.md#L1-L1188
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/rfork_loader.py#L630-L682'
  - 'vllm-ascend@7d825229:vllm_ascend/model_loader/rfork/session.py#L100-L160'
verified:
  - 'rfork:main'
evidence: C
relations:
  - to: rfork
    kind: builds-on
    note: 总览先分清 Planner、元数据 HTTP 与字节传输，这里按真实调用顺序串起来
  - to: npu-worker-lifecycle
    kind: builds-on
    note: RFork 只替换 Worker 启动里装权重那一步，先知道前后还有哪些步骤
contradicts: []
updated: '2026-10-25'
rawSources:
  - >-
    raw/sha256-280c501d0e376e2b74d0e921324d49b1ce5a99025fb3935c1e55f50fa73111da.md
  - >-
    raw/sha256-629e6f8b0215485342250f376eedf494ef1b55f5de26f189da5f5a615659eba1.md
  - >-
    raw/sha256-b55b32722cce760cf460a51943536138061f6322f2cac46d335a5c783df5da72.md
  - >-
    raw/sha256-be7651d21c2f6c44f19cb939989ef0d4119a8cdfdaf2f59003e14ee2166cd069.md
---

## B 用 RFork 启动时，先做什么、后做什么，借不到怎么办

沿用[总览](rfork.md)的两个实例：A 已经正常加载、正在服务，是可以被借的 seed（已经加载好、能对外提供权重的来源）；B 正在启动，想把 A 显存里的权重直接读过来。B 不是整台机器一起借，而是每个 Worker（管一张卡的那个进程）各自走一遍加载。

**RFork 启动，就是 B 的每个 Worker 在「装权重」这一步走的十步路：先在本卡把模型搭好、把布局转成 A 对外的样子，再向 Planner（记录有哪些 seed 可借的外部服务）申请租约（Planner 发的一次借用凭据，有名额和有效期）、按地址读权重；借不到或读失败，先把这一轮清理干净，再从存储按普通方式加载一遍。** 两条路的终点一样：交回模型，并尝试把 B 自己也发布成 seed。「模型加载成功」和「发布成 seed 成功」是两件分开判断的事。

```wiki-diagram
file: rfork-startup
```

图左边的竖条把十步分成三段。前六步只在本卡做准备，还没向 Planner 要任何东西；第 7 步拿到租约后占用 A 的借用名额。第 8 步读完后不再读取 A 的权重字节，但名额仍要等 Planner 确认归还或回收；后台归还不阻塞模型继续启动，未确认时 B 自己的 seed 发布会延期。右边是两处提前离开和一条失败支路：失败支路先清理、再普通加载，最后汇回第 10 步。

RFork 只替换 Worker 启动里装权重的那一步，前后顺序见 [Worker 生命周期](npu-worker-lifecycle.md#一张卡上的-worker启动时按什么顺序做准备)：建通信组在它之前，量显存预算、建 KV cache 池、录图在它之后，这些步骤照常进行。本页讲的是 RFork 工作版的行为；社区各版本的顺序不一样，放在页末对照。

## 为什么不一上来就借

最直觉的做法是 B 一启动就去 Planner 那里借 A，可工作版偏偏把申请放到第 7 步，先干完一大堆自己的活。原因有两层。

**第一层：B 得先有地方放。** 读权重是按地址把 A 显存里的字节写进 B 显存里的对应位置。B 必须先知道自己有哪些层、每个张量多大、什么数据类型、什么存储布局，才能告诉传输引擎「读到我这里的这些地址」。RFork 没法只拿一个模型名字，就把远端的模型「挂」进 B，所以搭模型这一步的成本照样要付。

**第二层：租约是有限的名额，还有有效期。** 租约是 Planner 发给 B 的一次借用凭据：借出时，Planner 在 A 名下记一笔占用，B 归还或者有效期到了才划掉。仓库自带的示例 Planner 里，每个 seed 默认只有 1 个借用名额，租约有效期默认 60 秒。如果 B 先借再搭模型，搭模型、布局后处理、等 NPU 同步这些只和 B 自己有关的活全都算进租约时间：在示例 Planner 的默认设置下，这段时间别的实例来借同一个 A，Planner 只能回答「没有」；准备得慢一点，有效期在读权重之前就耗掉了一大截。先准备、后申请，就是为了把本地准备从租约时间里拿掉。晚申请以后，租约覆盖的主要只剩登记内存、要清单、读数据，以及读完后在后台归还。有效期到了以后会发生什么，见[租约与生命周期](rfork-lifecycle.md)。

**代价是没借到时白准备了一遍。** 第 7 步发现没有可借的 seed 时，B 已经搭过模型；要转布局的模型（开了量化、权重 NZ 模式配成 2、或硬件要求 NZ 格式，三条任一成立）还已经转过布局。工作版不把这份空模型直接交给普通加载器去填，而是清掉重建，所以一次没命中的冷启动，搭模型和布局处理都要做两遍。这是晚申请换来的固定代价。

这几段各花多久，工作版都单独打了耗时日志：搭模型、布局处理、申请租约、登记加读取各一条，读取内部还有登记、要清单、读数据三段的分段耗时，日志原文列在页末。要判断晚申请省了多少、未命中多付了多少，就拿这几条日志比。整个服务什么时候就绪也不能拿读权重那一段代替：模型交回以后还有量显存、录图等步骤。RFork 缩短的是加载等待，不改变之后逐步 decode 的速度。

## 十步各做什么，做完手里有什么

十步里每一步用到的定义都在本章别的页：身份怎么算看[身份匹配](rfork-identity.md)，布局两条路看[张量布局](rfork-layout.md)，读权重的四步看[传输与内存](rfork-transfer.md)，会话从「已初始化」到「当 seed」的各个阶段看[租约与生命周期](rfork-lifecycle.md)。这里只讲它们在启动里的先后。

| 步 | B 做了什么 | 做完手里有什么 |
|---|---|---|
| 1 | 启动参数选了 RFork 加载方式 | 从加载器额外配置里读出的 RFork 配置 |
| 2 | 检查 EPLB 相关开关 | 命中就直接普通加载，不建会话 |
| 3 | 建这次加载的会话；主模型和草稿模型各有一个，分开建 | 本卡的身份（兼容性指纹加分片编号）、Planner 客户端、传输引擎；会话处在「已初始化」 |
| 4 | 先给进程里的全局登记拍快照，再在卡上搭空模型 | 本次尝试的模型对象，放权重的空位已经分配好 |
| 5 | 看草稿模型是不是整份共用主模型的权重 | 整份共用就直接交回，后面全跳过 |
| 6 | 要转布局的模型先对空参数做布局后处理，并等 NPU 同步完 | 空位已经是 A 对外暴露的最终布局 |
| 7 | 向 Planner 申请租约 | 一张身份对得上的租约，会话进入「已借到」；或者明确没拿到 |
| 8 | 登记本地内存、向 A 要清单并核对、分批读 | 权重读进了空位，会话进入「已传完」 |
| 9 | 先读后处理的路径，到这一步才做适用的后处理；跳过未量化 MoE 的重复后处理，然后切到推理模式 | 可以交回去的模型 |
| 10 | 交回之前，尝试把 B 发布成 seed | 已启动、延期或失败，三种都不影响模型交回 |

第 6 步和第 9 步的后处理二选一，由上面那三个条件决定，判断细节见[张量布局](rfork-layout.md#先看-b-要不要转布局)：任一成立就走「转好布局再搬」，后处理在第 6 步、申请租约之前做完，第 9 步只剩切推理模式；都不成立就走「先读后处理」，第 6 步跳过，读完以后在第 9 步才做适用的后处理。这条路径在代码中叫 checkpoint，但 A 的未量化 MoE 权重也可能已经转置，B 读取后会跳过它的重复后处理，不能把路径名理解成一律按 checkpoint 原形状搬。所以不能拿「量化 / 非量化」代替这三个条件：不量化的模型，只要权重 NZ 模式配成 2 或硬件强制 NZ，也会在第 6 步做后处理。

第 8 步从开始登记那一刻起，会话就被标成「需要清理」，登记、要清单、读数据全部成功才改成「已传完」。所以归还租约的后台线程只有整段读成功之后才会启动；任何一步失败都不走这条路，而是由后面的回退清理去安排归还。第 10 步要让下一个实例能读 B 的显存：转好布局再搬、刚传完的，沿用第 8 步的登记；先读后处理的（第 9 步的适用后处理可能换掉存储）或回退后新加载的模型，要先把整份模型重新登记一遍再发布。租约还没确认归还时，发布先记成延期，等后台确认后再补上。

把同样的十步放进三种情况，就能看清哪些步一定会做、哪些白做：

| 情况 | 走到哪几步 | 结果 |
|---|---|---|
| 借到了，读也成功 | 1–10 全走 | 权重来自 A；租约在后台归还，确认后 B 才真正当上 seed |
| Planner 里没有对得上的 seed | 1–7，然后回退 | 第 4 步（要转布局时还有第 6 步）白做一遍；清理后普通加载，再尝试发布成 seed |
| 借到了，读到一半失败 | 1–8，然后回退 | 租约交给后台去还；清理后普通加载，再尝试发布成 seed |

## 两处提前离开，不是漏了步骤

- **开了 EPLB 就整个绕过 RFork。** EPLB 是专家负载均衡：运行中按专家的冷热调整专家放在哪张卡上，见 [EPLB](eplb.md)。判断条件有三个，任何一个成立都算：并行配置里开了 EPLB、vLLM 附加配置的 EPLB 设置里开了动态模式、或者那里填了导出专家分布的记录路径。命中后加载器在建会话之前就直接普通加载，之后也不按 RFork 流程发布 seed。偏偏这时的日志只说「开了动态 EPLB 时关闭 RFork 传输」：只开了普通 EPLB、或者只想导出专家分布的人，照字面读会以为自己不受影响。这条路上普通加载自己失败，会另打一行日志再把异常抛出去。
- **草稿模型整份共用主模型的权重。** 投机解码的草稿模型（先猜后面几个 token、再交给主模型验证的那部分，见[投机解码](speculative-decoding.md)）和主模型各有一个会话。建完会话，草稿会话先取来主模型已经登记过的显存范围。草稿要传的每个张量都落在这些范围里、也没有不在 NPU 上的张量时，加载器直接复用这些权重、切到推理模式交回：不申请租约，不重复做布局后处理，这一次也不把草稿发布成 seed。只共用一部分的草稿会继续往下走，只传自己独有的张量，见[传输与内存](rfork-transfer.md#主模型和草稿模型共享地址时谁登记谁来传)。

## 借不到或读失败：先拆干净，再从磁盘重来

回退不是把模型变量删掉就完事。模型在搭建时，会被好几处进程级的登记表、缓存和已登记的内存引用着；这些引用不清掉，旧模型的显存就放不掉，再普通加载一份，就是两份权重同时占卡。下图是回退这一段的先后与分支：

```wiki-diagram
file: rfork-startup-fallback
```

会话建起来了，回退先做三件事：停掉 seed 服务、安排归还租约、注销这次登记的内存，最多试两轮。注销这一层怎样才算撤干净，见[传输与内存](rfork-transfer.md#任何一步失败先撤销再回退)。判断能不能继续往下走，看的是服务停了没有、内存注销了没有；租约是交给后台线程去还的，不要求这时已经确认还掉。

接着，只要第 4 步开始搭过模型，加载器就按那时拍的快照，撤掉这次尝试在进程里留下的登记。要清的地方有六类：

| 要清的东西 | 为什么它会留住旧模型 |
|---|---|
| 搭层时登记的前向上下文 | 登记进去的层对象还挂在编译配置上 |
| 全局的 MoE 层列表 | 列表里还引用着专家层 |
| 昇腾 EPLB 适配层的 MoE 登记表 | 昇腾的 MoE 层构造时会把自己登记进这张表，不管开没开 EPLB |
| RoPE（旋转位置编码）的缓存 | 搭模型时新加进去的缓存条目 |
| 编译器留下的字节码钩子 | 绑定的方法会把编译包装乃至整个解码器一起保活 |
| 传输后端持有的张量和底层存储 | 注销没确认之前，必须保住底层内存 |

前五类由加载器按快照恢复：快照之前就有的条目，比如已经加载成功的主模型留下的，原样保留，只摘掉这次尝试新加的。第三类不能拿「没开 EPLB」当理由跳过：走到 RFork 这条路时 EPLB 一定没开，可表里照样记着这次的层。最后一类由传输后端在注销时自己管。模型构造到一半就抛错、模型变量还没赋上值的情况也要清，所以判断条件是「开始搭过」，而不是「手里有模型」。

如果停服务或注销内存仍然失败，加载器直接报错终止，拒绝再分配一份模型：旧权重还被登记钉在显存里，再分配一份就是两份权重同时占卡。这是有意的保护，不是「把错误吞掉继续跑」，**不要为了让回退成功而删掉这个检查**。清理通过以后，加载器回收半成品模型、反复清空 NPU 缓存，再进入下一节的普通加载。

会话根本没建起来时，比如漏填了三项必填配置、实例上没装 YuanRong 传输引擎，既没有内存登记要撤，也没有搭过模型，加载器跳过清理直接普通加载。但没有会话，事后也就不会把自己发布成 seed。

## 重来时，只把加载方式改回普通

回退用的加载配置是从原配置复制出来的一份：加载方式改成自动，RFork 的加载器额外配置清空，再交给 vLLM 的普通加载入口。这样 RFork 配置不会绕一圈又把普通加载带回 RFork。反过来，模型路径、权重文件这些普通加载要用的东西必须照样可用；布局后处理由普通加载在读完 checkpoint 之后自己再做一遍。

普通加载自己也失败时，加载器打一行专门的日志，再把异常抛出去。这时要同时看两样东西：前面那条说明 RFork 为什么失败的警告（或者「没有可用 seed」那一行），以及普通加载具体错在哪。只盯前一条，会把存储或路径的问题误当成 RFork 的问题。

普通加载成功后，只要会话在（走到这里说明清理已经合格），加载器就尝试把这个实例发布成 seed：回退后的模型是新分配的，发布前要把整份模型重新登记一遍；租约还在后台归还时，发布先记成延期。发布失败，加载好的模型也原样交回，后面的启动流程照常继续，只是这个实例暂时不当别人的来源。

## 「没有可用 seed」有三类来源，要靠旁边的日志分开

第 7 步没拿到租约，加载器内部一律当成同一种「没借到」处理，并打出一行「没有可用的主模型 / 草稿 seed，本地加载并把自己注册成 seed」。这一行只在 TP 组里编号为 0 的 Worker 上按 info 级别打出，其他 Worker 只打 debug 级别，默认日志里看不到。没拿到租约其实有三类来源，这一行本身不区分，要看它旁边还有什么：

| 哪一类 | 发生了什么 | 旁边能看到什么 |
|---|---|---|
| Planner 回 404 | 问到了，但 Planner 那里没有 seed key（按身份算出的匹配键）对得上、又还有空名额的 seed | 客户端只在 debug 级别记一笔，默认日志里没有别的线索；接着查两端的 seed key，见[身份匹配](rfork-identity.md) |
| 问了，但出错 | 连不上、超时、回了 200 和 404 以外的状态，或者响应头缺字段、端口或 rank 不能转为整数、端口 ≤0 或 rank <0 | 每个 Worker 都有一条客户端警告，写着向 Planner 申请失败和具体原因 |
| 会话自己拒绝，根本没去问 | 上一张租约的归还线程还活着、归还已经停止、还留着一张没还掉的旧租约，或者会话不在「已初始化」 | 只有最后一种打错误日志；前三种要回头翻本进程更早的租约归还日志，见[租约与生命周期](rfork-lifecycle.md) |

所以先看有没有客户端警告，再看会话状态，最后才下「Planner 里没有匹配来源」的结论。Planner 自己的请求记录可以辅助定位，但连接失败时请求根本没到 Planner，Planner 那边没有记录，并不能单独证明是会话拒绝了申请。反过来，每个借到租约的 Worker 都会按 info 级别打一行「已借到租约」，带着全局编号；数这一行，就能知道哪些会话真的借到了。

## 放到 GLM 双机：一次冷启动，32 个会话各走一遍

这一节是推演：工作版的代码树里没有 GLM-5.3-Flash 的模型实现，GLM 的模型代码只在固定镜像里，下面把两边放在一起推。每张卡读多少字节、分几批，已经在总览的 [GLM 双机推演](rfork.md#放到-glm-双机再起一个同构实例每张卡借多少)里算过；这里只看十步在这套部署上怎么走。

- **谁走这十步。** 部署是一个实例跨两台机器、16 张卡，TP8、DP2、EP16、W8A8，见[部署前提](glm-5-3-flash-two-node.md#部署前提)。16 个 Worker 各自加载主模型和 MTP 草稿模型（GLM 自带、在投机解码里先猜后面 token 的那一层），各有一个会话，一共 32 个会话，每个都按这十步走一遍。钥匙和租约为什么也是 32 份，见[身份匹配](rfork-identity.md)。
- **第 2 步不触发。** 教程的两机启动命令没有开 EPLB，也没配专家分布记录路径。以后打开 EPLB，32 个会话都会在第 2 步直接改走普通加载。
- **第 5 步不会提前离开。** GLM 的草稿模型自己那一层 MTP 权重本来就独有，不在主模型的显存里；加载那一刻它还拿着自己新建的词嵌入和输出头，要等加载结束后才换成主模型的同名张量，这两份也要传。所以草稿会话也要走完第 6–10 步，见[传输与内存](rfork-transfer.md#主模型和草稿模型共享地址时谁登记谁来传)。
- **第 6 步一定做。** W8A8 开了量化，三个条件的第一条就成立，走「转好布局再搬」：搭完空模型，先对空参数做转置和昇腾 NZ 存储格式的转换，等 NPU 同步完再申请租约；第 9 步只剩切推理模式。为什么省不掉这一步，见[张量布局](rfork-layout.md#放到-glm-双机w8a8-走哪条路哪些张量要留意)。
- **第一次冷启动一定回退。** 这套部署只有一个实例，DP2 是实例内部的两组，不是两个实例。第一次启动时 Planner 里还没有任何 seed：Planner 在线的话，32 个会话都在第 7 步拿到 404，各自清理后从存储普通加载，再把自己发布成 seed，搭模型和 W8A8 的布局后处理都付了两遍。收益只在扩副本或重启、而且已经有一个同构 seed 时才出现，见[这套部署现在能不能受益](rfork.md#这套部署现在能不能受益)。
- **默认日志里数得到的行。** TP8 下 TP 组编号为 0 的是第 0 号和第 8 号卡，每台机器一张。所以一次全部落空的冷启动，「没有可用 seed」在默认日志里一共只有 4 行：每台机器上主模型、草稿模型各 1 行，另外 28 行在 debug 级别。只看到 4 行，不代表另外 28 个会话借到了。
- **发布以后多占的显存。** 回退后发布 seed 要把整份模型登记一遍，被登记张量的存储会一直活着。草稿那两份词表张量因此被钉住、KV 块变少的推断，见[这套部署现在能不能受益](rfork.md#这套部署现在能不能受益)。

## 常见误解

- **「借不到 seed 就等于什么都没做」**——申请排在搭模型和布局处理之后，没借到时这些已经做过，冷启动要付两遍。
- **「回退就是在同一份模型上重新读一遍文件」**——工作版先清理、再重建，避免转了一半的布局和普通加载器的假设冲突。
- **「只开了普通 EPLB、没开动态模式，RFork 照样会跑」**——三个条件任一成立都会绕过；日志里写的「动态 EPLB」只是统一的说法。
- **「默认日志里只有几行『没有可用 seed』，其他卡就是借到了」**——这一行只在 TP 组编号为 0 的 Worker 上按 info 打；要确认借到，数「已借到租约」那一行。
- **「看到 seed 启动失败，就得重新加载模型」**——模型已经交回时，seed 只是附加服务；要单独看后面推理是否就绪。

## 对照源码

### 怎么开

启动参数 `--load-format rfork` 选中 `RForkModelLoader`，RFork 配置从 `--model-loader-extra-config` 读成 `RForkConfig`。[C1] 三项必填（`model_url`、`model_deploy_strategy_name`、`rfork_scheduler_url`）缺任何一项，`RForkSession` 构造时就抛 `ValueError`；同一个构造函数里还会新建 `RForkTransferBackend`，没装 `yr.datasystem` 就抛 `ImportError`。这两种异常都发生在 `load_model` 的保护区里，落进回退，且此时 `session is None`，回退后不发布 seed。[C16] 各项设置的含义见[配置](rfork-config.md)。

EPLB 绕过的判定函数叫 `_is_dynamic_eplb_enabled`，但三个条件任一为真都返回 true：`parallel_config.enable_eplb`、`additional_config["eplb_config"]["dynamic_eplb"]`、`additional_config["eplb_config"]["expert_map_record_path"]` 非空。[C9] 所以只加了 `--enable-eplb`，或只设了 `expert_map_record_path`，RFork 同样不跑。

第 6 / 9 步走哪条由 `_requires_processed_layout_transfer` 决定：`model_config.quantization` 非空，或 `get_ascend_config().weight_nz_mode == 2`，或当前硬件 profile 的 `weight_layout_policy` 是 `FORCE_NZ`，任一成立就返回 True（rfork_loader.py L503-L519）。[C2] 为 True 时第 6 步在 `_rfork_pre_transfer_weight_processing` 里跑 `process_weights_after_loading` 并 `torch.npu.synchronize()`；为 False 时第 9 步在 `_rfork_skip_unquantized_moe_post_load_processing` 里跑。

回退配置由 `_make_fallback_load_config` 生成：原 `LoadConfig` 的浅拷贝，`load_format` 设成 `"auto"`，`model_loader_extra_config` 清空，再调 vLLM 的 `get_model`。[C5]

### 会报什么错

| 日志原文 | 级别 | 对应上文哪一段 |
|---|---|---|
| `RFork transfer is disabled when dynamic EPLB is enabled; using the default model loader.` | warning | 第 2 步绕过，三个条件任一命中都打这句 |
| `RFork disabled for dynamic EPLB, but default loader failed.` | exception，随后抛出 | 绕过后普通加载失败 |
| `RFork planner seed acquisition failed: …` | warning，每个 Worker 都打 | 第 7 步问了但出错，见来源 12 |
| `RFork seed acquisition requires an initialized session; state=…` | error | 会话状态不对，没去问 |
| `RFork has no available main/draft seed; loading locally and registering this worker as a seed.` | TP 编号 0 为 info，其余 debug | 第 7 步没拿到租约，三类来源不区分，见来源 4 |
| `RFork transfer failed: …, clean up and fall back to default loader` | warning | 第 3–9 步抛错，或第 8 步返回失败；第 10 步发布出错不回退 |
| `RFork fallback aborted because seed service or registered memory cleanup failed; … Refusing to allocate a second model while old weights are pinned.` | 抛 `RuntimeError` | 清理不干净，拒绝回退 |
| `RFork fallback default loader failed.` | exception，随后抛出 | 回退后普通加载失败 |
| `RFork main/draft model loaded from transfer/fallback is ready, but seed service startup failed; inference can continue.` | warning（抛异常时是 exception 级的 `… seed service startup raised; …`） | 第 10 步发布失败，模型照样交回，见来源 6 |
| `RFork seed memory registration raised; cleaning up before continuing inference.` | exception | 第 10 步重新登记时出错，随后按发布失败处理 |
| `RFork seed promotion is deferred until the source seed lease is released; the transferred model remains available for inference.` | warning | 第 10 步租约还没确认归还，发布记成延期 |
| `RFork cannot prepare a finalized session for fallback.` | error | 会话已经关停（FINALIZED），清理三项都算失败，于是拒绝回退 |

借到租约的 Worker 会打 info 级的 `RFork lease acquired: lease=… global_rank=… request_elapsed=…`。`session.acquire_seed()` 返回 False 有两处来源：本地自检（归还停止事件已置位、归还线程存活、旧租约仍未还掉、状态不是 `INITIALIZED`），以及 `RForkPlannerClient.acquire_seed` 返回 `None`；后者对 404 只打 debug，对连接异常、200/404 以外的状态、缺响应头、端口或 rank 不能转为整数、端口 ≤0 或 rank <0 打 warning。本地自检见来源 11，HTTP 响应检查见来源 12。端口大于 65535 可以先拿到租约，随后构造来源 URL 时失败，进入[传输失败的汇总与清理](rfork-troubleshooting.md#会报什么错)。

回退清理：session 存在时调 `prepare_for_fallback`，依次停 seed 服务、`_release_seed_locked`（只安排后台归还，不等确认）、注销 MR；加载器最多调 `FALLBACK_CLEANUP_MAX_ATTEMPTS = 2` 轮。`RForkFallbackCleanupResult.can_schedule_seed` 只看 `service_stopped and memory_reset`，不要求 `lease_released`。[C7] 租约的后台归还线程只在 `transfer_from_seed` 整段成功后才启动。[C10] 回退或 checkpoint 布局下，`start_seed_service` 会先重新 `register_memory_region` 再起服务；租约未还时返回 `DEFERRED`。[C17]

### 开销和什么时候别开

晚申请：`acquire_seed` 排在 `initialize_model`、processed-layout 后处理与 `torch.npu.synchronize()` 之后。工作版设计说明 `rfork_lease_lifecycle.md` 的方案表把它的收益写成把本地准备移出租约有效期，代价写成未命中时丢掉准备好的模型、再跑一遍默认加载。[S13]

示例 Planner 的 `lease_ttl_sec` 默认 60、`default_resource_points` 默认 1，可用环境变量 `RFORK_MOCK_LEASE_TTL_SEC`、`RFORK_MOCK_DEFAULT_RESOURCE_POINTS` 改；`get_seed` 每借出一次占 1 点，用满就返回空。[C15] 「先借后搭会占住名额、吃掉有效期」是按这两个默认值和设计说明推出的，不是测量结果。[I]

耗时日志（每个 Worker 都按 info 打）：`RFork %s model initialization took %.2f seconds`、`RFork %s model layout processing took %.2f seconds`、`RFork %s seed acquisition took %.2f seconds`、`RFork %s model registration and transfer took %.2f seconds`；`transfer_from_seed` 里另有 `RFork transfer stages: lease=… global_rank=… registration=… metadata=… read=…`。[C3]

未命中时，已初始化（`_requires_processed_layout_transfer` 为真时还已转过布局）的模型不会交给 checkpoint loader 去填，而是清掉重建，所以一次没命中的冷启动，模型准备开销要付两遍。只有一个实例的部署第一次启动必然未命中，GLM 双机就是这种情况。[D] 会开 EPLB 的部署（包括只想导出专家分布的），RFork 不生效，见「怎么开」。

### 版本差异

本页的十步图按 RFork 工作版 `rfork@3284850b` 组织。以下三个旧社区快照启动顺序不同，布局判断也只看 quantization 是否非空，没有 NZ 模式和硬件策略两项；rc2 的新顺序另列在后面。

- **v0.23**（维护分支 `2c59ff10`，RFork 目录与固定镜像 `db701c1f` 逐字节相同）：搭模型之前先调 `is_seed_available()` 问 Planner；绕过条件是 `layer_sharding` 或同样三个 EPLB 条件；后处理之后不等 NPU 同步；回退时注销内存后 `del model`、清缓存，不恢复进程级登记。[C19]
- **v0.26**（`2ed6cbba`）：与 v0.23 相同，只是绕过条件去掉了 `layer_sharding`。[C20]
- **main**（`baa023ad`）：仍是先问后搭；合入了补丁 0001，后处理后等同步，回退时调 `_reset_process_global_model_state` 摘掉本模型的进程级登记；但注销失败只打警告、照常回退，不像工作版那样拒绝。[C21]

- **v0.30.0rc2**（`7d825229`）：先建模型和准备布局，再登记目的内存、把可传张量的结构摘要绑定到身份，最后才申请租约并取清单、读数据。申请要求会话处于 REGISTERED 状态；工作版是先借后登记。因此不能将十步图的第7、8步顺序直接用于 rc2。实际入口在 rfork_loader.py 630–682，登记与申请检查在 session.py 100–160，固定源码链接见[总览](rfork.md#版本差异)。

完整的补丁对照见[总览的版本差异](rfork.md#版本差异)。

### 源码位置

| 上文的哪一步 | 代码 |
|---|---|
| 1 选中加载器 | `RForkModelLoader`，读 `RForkConfig` |
| 2 EPLB 绕过 | `_is_dynamic_eplb_enabled` |
| 3 建会话 | `_ensure_rfork_session`：`RForkIdentity`、`RForkSession`（内含 `RForkPlannerClient`、`RForkTransferBackend`） |
| 4–7 快照、搭模型、草稿全共享判断、布局后处理、申请租约 | `load_model` 前半段：`_snapshot_process_global_model_state` → `initialize_model` → `can_reuse_shared_weights` → `process_weights_after_loading` → `acquire_seed` |
| 8–10 读权重、后处理与 `model.eval()`、发布 seed | `load_model` 后半段：`transfer_from_seed` → `_start_rfork_seed_service`（`STARTED` / `DEFERRED` / `FAILED`） |
| 回退清理与重建 | `prepare_for_fallback`、`_reset_process_global_model_state`、`_make_fallback_load_config` |
| 「没有可用 seed」的来源 | `RForkSession.acquire_seed`、`RForkPlannerClient.acquire_seed` |

回退清理恢复的五类全局引用在代码里的名字：`compilation_config.static_forward_context`、`compilation_config.static_all_moe_layers`、`VllmEplbAdaptor._registered_moe_layers`（`AscendFusedMoE` 构造时无条件登记，[C18]）、`_ROPE_DICT`、Dynamo bytecode hooks；第六类是 TransferEngine 持有的 Tensor / storage owners，由传输后端管理。

草稿全量共享时，`load_model` 直接 `return model.eval()`：不 `acquire_seed`、不重复布局后处理，也不调 `_start_rfork_seed_service`；部分共享的细节见[传输与内存](rfork-transfer.md)。

**待核：缺什么**（全页的不确定项都集中在这里）

1. 生产环境 Planner 的借用名额与租约有效期。上文的 1 个名额、60 秒是仓库示例 Planner 的默认值。
2. 晚申请实际省下多少租约时间、未命中多付多少准备时间：要在现场用上面的耗时日志量，本页不给估算数。
3. GLM 双机的走法是「工作版加载器 + 固定镜像 GLM 模型」的组合推演，没有可以直接运行的提交。32 个会话在首次冷启动全部回退、默认日志里只有 4 行「没有可用 seed」，都要在合并后的代码上实跑核对。[D]
4. 草稿两份词表张量被登记钉住、KV 块变少，是总览里按源码推出的结论，同样缺实测。

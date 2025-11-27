type Without<T, U> = {
	[P in Exclude<keyof T, keyof U>]?: never;
};
type XOR<T, U> = T | U extends object
	? (Without<T, U> & U) | (Without<U, T> & T)
	: T | U;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type OneOf<T extends any[]> = T extends [infer Only]
	? Only
	: T extends [infer A, infer B, ...infer Rest]
		? OneOf<[XOR<A, B>, ...Rest]>
		: never;

export interface components {
	schemas: {
		ErrorResponse: {
			/**
			 * Format: float
			 * @description Time spent to process this request
			 */
			time?: number;
			status?: {
				/** @description Description of the occurred error. */
				error?: string;
			};
			result?: Record<string, unknown> | null;
		};
		/**
		 * @example {
		 *   "collections": [
		 *     {
		 *       "name": "arivx-title"
		 *     },
		 *     {
		 *       "name": "arivx-abstract"
		 *     },
		 *     {
		 *       "name": "medium-title"
		 *     },
		 *     {
		 *       "name": "medium-text"
		 *     }
		 *   ]
		 * }
		 */
		CollectionsResponse: {
			collections: components["schemas"]["CollectionDescription"][];
		};
		CollectionDescription: {
			name: string;
		};
		/** @description Current statistics and configuration of the collection */
		CollectionInfo: {
			status: components["schemas"]["CollectionStatus"];
			optimizer_status: components["schemas"]["OptimizersStatus"];
			/**
			 * Format: uint
			 * @description DEPRECATED: Approximate number of vectors in collection. All vectors in collection are available for querying. Calculated as `points_count x vectors_per_point`. Where `vectors_per_point` is a number of named vectors in schema.
			 */
			vectors_count?: number | null;
			/**
			 * Format: uint
			 * @description Approximate number of indexed vectors in the collection. Indexed vectors in large segments are faster to query, as it is stored in a specialized vector index.
			 */
			indexed_vectors_count?: number | null;
			/**
			 * Format: uint
			 * @description Approximate number of points (vectors + payloads) in collection. Each point could be accessed by unique id.
			 */
			points_count?: number | null;
			/**
			 * Format: uint
			 * @description Number of segments in collection. Each segment has independent vector as payload indexes
			 */
			segments_count: number;
			config: components["schemas"]["CollectionConfig"];
			/** @description Types of stored payload */
			payload_schema: {
				[key: string]: components["schemas"]["PayloadIndexInfo"] | undefined;
			};
		};
		/**
		 * @description Current state of the collection. `Green` - all good. `Yellow` - optimization is running, 'Grey' - optimizations are possible but not triggered, `Red` - some operations failed and was not recovered
		 * @enum {string}
		 */
		CollectionStatus: "green" | "yellow" | "grey" | "red";
		/** @description Current state of the collection */
		OptimizersStatus: OneOf<
			[
				"ok",
				{
					error: string;
				},
			]
		>;
		/** @description Information about the collection configuration */
		CollectionConfig: {
			params: components["schemas"]["CollectionParams"];
			hnsw_config: components["schemas"]["HnswConfig"];
			optimizer_config: components["schemas"]["OptimizersConfig"];
			wal_config?:
				| components["schemas"]["WalConfig"]
				| (Record<string, unknown> | null);
			/** @default null */
			quantization_config?:
				| components["schemas"]["QuantizationConfig"]
				| (Record<string, unknown> | null);
			strict_mode_config?:
				| components["schemas"]["StrictModeConfigOutput"]
				| (Record<string, unknown> | null);
		};
		CollectionParams: {
			vectors?: components["schemas"]["VectorsConfig"];
			/**
			 * Format: uint32
			 * @description Number of shards the collection has
			 * @default 1
			 */
			shard_number?: number;
			/** @description Sharding method Default is Auto - points are distributed across all available shards Custom - points are distributed across shards according to shard key */
			sharding_method?:
				| components["schemas"]["ShardingMethod"]
				| (Record<string, unknown> | null);
			/**
			 * Format: uint32
			 * @description Number of replicas for each shard
			 * @default 1
			 */
			replication_factor?: number;
			/**
			 * Format: uint32
			 * @description Defines how many replicas should apply the operation for us to consider it successful. Increasing this number will make the collection more resilient to inconsistencies, but will also make it fail if not enough replicas are available. Does not have any performance impact.
			 * @default 1
			 */
			write_consistency_factor?: number;
			/**
			 * Format: uint32
			 * @description Defines how many additional replicas should be processing read request at the same time. Default value is Auto, which means that fan-out will be determined automatically based on the busyness of the local replica. Having more than 0 might be useful to smooth latency spikes of individual nodes.
			 */
			read_fan_out_factor?: number | null;
			/**
			 * @description If true - point's payload will not be stored in memory. It will be read from the disk every time it is requested. This setting saves RAM by (slightly) increasing the response time. Note: those payload values that are involved in filtering and are indexed - remain in RAM.
			 *
			 * Default: true
			 * @default true
			 */
			on_disk_payload?: boolean;
			/** @description Configuration of the sparse vector storage */
			sparse_vectors?: {
				[key: string]: components["schemas"]["SparseVectorParams"] | undefined;
			} | null;
		};
		/**
		 * @description Vector params separator for single and multiple vector modes Single mode:
		 *
		 * { "size": 128, "distance": "Cosine" }
		 *
		 * or multiple mode:
		 *
		 * { "default": { "size": 128, "distance": "Cosine" } }
		 */
		VectorsConfig:
			| components["schemas"]["VectorParams"]
			| {
					[key: string]: components["schemas"]["VectorParams"] | undefined;
			  };
		/** @description Params of single vector data storage */
		VectorParams: {
			/**
			 * Format: uint64
			 * @description Size of a vectors used
			 */
			size: number;
			distance: components["schemas"]["Distance"];
			/** @description Custom params for HNSW index. If none - values from collection configuration are used. */
			hnsw_config?:
				| components["schemas"]["HnswConfigDiff"]
				| (Record<string, unknown> | null);
			/** @description Custom params for quantization. If none - values from collection configuration are used. */
			quantization_config?:
				| components["schemas"]["QuantizationConfig"]
				| (Record<string, unknown> | null);
			/** @description If true, vectors are served from disk, improving RAM usage at the cost of latency Default: false */
			on_disk?: boolean | null;
			/**
			 * @description Defines which datatype should be used to represent vectors in the storage. Choosing different datatypes allows to optimize memory usage and performance vs accuracy.
			 *
			 * - For `float32` datatype - vectors are stored as single-precision floating point numbers, 4 bytes. - For `float16` datatype - vectors are stored as half-precision floating point numbers, 2 bytes. - For `uint8` datatype - vectors are stored as unsigned 8-bit integers, 1 byte. It expects vector elements to be in range `[0, 255]`.
			 */
			datatype?:
				| components["schemas"]["Datatype"]
				| (Record<string, unknown> | null);
			multivector_config?:
				| components["schemas"]["MultiVectorConfig"]
				| (Record<string, unknown> | null);
		};
		/**
		 * @description Type of internal tags, build from payload Distance function types used to compare vectors
		 * @enum {string}
		 */
		Distance: "Cosine" | "Euclid" | "Dot" | "Manhattan";
		HnswConfigDiff: {
			/**
			 * Format: uint
			 * @description Number of edges per node in the index graph. Larger the value - more accurate the search, more space required.
			 */
			m?: number | null;
			/**
			 * Format: uint
			 * @description Number of neighbours to consider during the index building. Larger the value - more accurate the search, more time required to build the index.
			 */
			ef_construct?: number | null;
			/**
			 * Format: uint
			 * @description Minimal size (in kilobytes) of vectors for additional payload-based indexing. If payload chunk is smaller than `full_scan_threshold_kb` additional indexing won't be used - in this case full-scan search should be preferred by query planner and additional indexing is not required. Note: 1Kb = 1 vector of size 256
			 */
			full_scan_threshold?: number | null;
			/**
			 * Format: uint
			 * @description Number of parallel threads used for background index building. If 0 - automatically select from 8 to 16. Best to keep between 8 and 16 to prevent likelihood of building broken/inefficient HNSW graphs. On small CPUs, less threads are used.
			 */
			max_indexing_threads?: number | null;
			/** @description Store HNSW index on disk. If set to false, the index will be stored in RAM. Default: false */
			on_disk?: boolean | null;
			/**
			 * Format: uint
			 * @description Custom M param for additional payload-aware HNSW links. If not set, default M will be used.
			 */
			payload_m?: number | null;
		};
		QuantizationConfig:
			| components["schemas"]["ScalarQuantization"]
			| components["schemas"]["ProductQuantization"]
			| components["schemas"]["BinaryQuantization"];
		ScalarQuantization: {
			scalar: components["schemas"]["ScalarQuantizationConfig"];
		};
		ScalarQuantizationConfig: {
			type: components["schemas"]["ScalarType"];
			/**
			 * Format: float
			 * @description Quantile for quantization. Expected value range in [0.5, 1.0]. If not set - use the whole range of values
			 */
			quantile?: number | null;
			/** @description If true - quantized vectors always will be stored in RAM, ignoring the config of main storage */
			always_ram?: boolean | null;
		};
		/** @enum {string} */
		ScalarType: "int8";
		ProductQuantization: {
			product: components["schemas"]["ProductQuantizationConfig"];
		};
		ProductQuantizationConfig: {
			compression: components["schemas"]["CompressionRatio"];
			always_ram?: boolean | null;
		};
		/** @enum {string} */
		CompressionRatio: "x4" | "x8" | "x16" | "x32" | "x64";
		BinaryQuantization: {
			binary: components["schemas"]["BinaryQuantizationConfig"];
		};
		BinaryQuantizationConfig: {
			always_ram?: boolean | null;
		};
		/** @enum {string} */
		Datatype: "float32" | "uint8" | "float16";
		MultiVectorConfig: {
			comparator: components["schemas"]["MultiVectorComparator"];
		};
		/** @enum {string} */
		MultiVectorComparator: "max_sim";
		/** @enum {string} */
		ShardingMethod: "auto" | "custom";
		/** @description Params of single sparse vector data storage */
		SparseVectorParams: {
			/** @description Custom params for index. If none - values from collection configuration are used. */
			index?:
				| components["schemas"]["SparseIndexParams"]
				| (Record<string, unknown> | null);
			/** @description Configures addition value modifications for sparse vectors. Default: none */
			modifier?:
				| components["schemas"]["Modifier"]
				| (Record<string, unknown> | null);
		};
		/** @description Configuration for sparse inverted index. */
		SparseIndexParams: {
			/**
			 * Format: uint
			 * @description We prefer a full scan search upto (excluding) this number of vectors.
			 *
			 * Note: this is number of vectors, not KiloBytes.
			 */
			full_scan_threshold?: number | null;
			/** @description Store index on disk. If set to false, the index will be stored in RAM. Default: false */
			on_disk?: boolean | null;
			/**
			 * @description Defines which datatype should be used for the index. Choosing different datatypes allows to optimize memory usage and performance vs accuracy.
			 *
			 * - For `float32` datatype - vectors are stored as single-precision floating point numbers, 4 bytes. - For `float16` datatype - vectors are stored as half-precision floating point numbers, 2 bytes. - For `uint8` datatype - vectors are quantized to unsigned 8-bit integers, 1 byte. Quantization to fit byte range `[0, 255]` happens during indexing automatically, so the actual vector data does not need to conform to this range.
			 */
			datatype?:
				| components["schemas"]["Datatype"]
				| (Record<string, unknown> | null);
		};
		/**
		 * @description If used, include weight modification, which will be applied to sparse vectors at query time: None - no modification (default) Idf - inverse document frequency, based on statistics of the collection
		 * @enum {string}
		 */
		Modifier: "none" | "idf";
		/** @description Config of HNSW index */
		HnswConfig: {
			/**
			 * Format: uint
			 * @description Number of edges per node in the index graph. Larger the value - more accurate the search, more space required.
			 */
			m: number;
			/**
			 * Format: uint
			 * @description Number of neighbours to consider during the index building. Larger the value - more accurate the search, more time required to build index.
			 */
			ef_construct: number;
			/**
			 * Format: uint
			 * @description Minimal size (in KiloBytes) of vectors for additional payload-based indexing. If payload chunk is smaller than `full_scan_threshold_kb` additional indexing won't be used - in this case full-scan search should be preferred by query planner and additional indexing is not required. Note: 1Kb = 1 vector of size 256
			 */
			full_scan_threshold: number;
			/**
			 * Format: uint
			 * @description Number of parallel threads used for background index building. If 0 - automatically select from 8 to 16. Best to keep between 8 and 16 to prevent likelihood of slow building or broken/inefficient HNSW graphs. On small CPUs, less threads are used.
			 * @default 0
			 */
			max_indexing_threads?: number;
			/** @description Store HNSW index on disk. If set to false, index will be stored in RAM. Default: false */
			on_disk?: boolean | null;
			/**
			 * Format: uint
			 * @description Custom M param for hnsw graph built for payload index. If not set, default M will be used.
			 */
			payload_m?: number | null;
		};
		OptimizersConfig: {
			/**
			 * Format: double
			 * @description The minimal fraction of deleted vectors in a segment, required to perform segment optimization
			 */
			deleted_threshold: number;
			/**
			 * Format: uint
			 * @description The minimal number of vectors in a segment, required to perform segment optimization
			 */
			vacuum_min_vector_number: number;
			/**
			 * Format: uint
			 * @description Target amount of segments optimizer will try to keep. Real amount of segments may vary depending on multiple parameters: - Amount of stored points - Current write RPS
			 *
			 * It is recommended to select default number of segments as a factor of the number of search threads, so that each segment would be handled evenly by one of the threads. If `default_segment_number = 0`, will be automatically selected by the number of available CPUs.
			 */
			default_segment_number: number;
			/**
			 * Format: uint
			 * @description Do not create segments larger this size (in kilobytes). Large segments might require disproportionately long indexation times, therefore it makes sense to limit the size of segments.
			 *
			 * If indexing speed is more important - make this parameter lower. If search speed is more important - make this parameter higher. Note: 1Kb = 1 vector of size 256 If not set, will be automatically selected considering the number of available CPUs.
			 * @default null
			 */
			max_segment_size?: number | null;
			/**
			 * Format: uint
			 * @description Maximum size (in kilobytes) of vectors to store in-memory per segment. Segments larger than this threshold will be stored as read-only memmapped file.
			 *
			 * Memmap storage is disabled by default, to enable it, set this threshold to a reasonable value.
			 *
			 * To disable memmap storage, set this to `0`. Internally it will use the largest threshold possible.
			 *
			 * Note: 1Kb = 1 vector of size 256
			 * @default null
			 */
			memmap_threshold?: number | null;
			/**
			 * Format: uint
			 * @description Maximum size (in kilobytes) of vectors allowed for plain index, exceeding this threshold will enable vector indexing
			 *
			 * Default value is 20,000, based on <https://github.com/google-research/google-research/blob/master/scann/docs/algorithms.md>.
			 *
			 * To disable vector indexing, set to `0`.
			 *
			 * Note: 1kB = 1 vector of size 256.
			 * @default null
			 */
			indexing_threshold?: number | null;
			/**
			 * Format: uint64
			 * @description Minimum interval between forced flushes.
			 */
			flush_interval_sec: number;
			/**
			 * Format: uint
			 * @description Max number of threads (jobs) for running optimizations per shard. Note: each optimization job will also use `max_indexing_threads` threads by itself for index building. If null - have no limit and choose dynamically to saturate CPU. If 0 - no optimization threads, optimizations will be disabled.
			 * @default null
			 */
			max_optimization_threads?: number | null;
		};
		WalConfig: {
			/**
			 * Format: uint
			 * @description Size of a single WAL segment in MB
			 */
			wal_capacity_mb: number;
			/**
			 * Format: uint
			 * @description Number of WAL segments to create ahead of actually used ones
			 */
			wal_segments_ahead: number;
		};
		StrictModeConfigOutput: {
			/** @description Whether strict mode is enabled for a collection or not. */
			enabled?: boolean | null;
			/**
			 * Format: uint
			 * @description Max allowed `limit` parameter for all APIs that don't have their own max limit.
			 */
			max_query_limit?: number | null;
			/**
			 * Format: uint
			 * @description Max allowed `timeout` parameter.
			 */
			max_timeout?: number | null;
			/** @description Allow usage of unindexed fields in retrieval based (e.g. search) filters. */
			unindexed_filtering_retrieve?: boolean | null;
			/** @description Allow usage of unindexed fields in filtered updates (e.g. delete by payload). */
			unindexed_filtering_update?: boolean | null;
			/**
			 * Format: uint
			 * @description Max HNSW value allowed in search parameters.
			 */
			search_max_hnsw_ef?: number | null;
			/** @description Whether exact search is allowed or not. */
			search_allow_exact?: boolean | null;
			/**
			 * Format: double
			 * @description Max oversampling value allowed in search.
			 */
			search_max_oversampling?: number | null;
			/**
			 * Format: uint
			 * @description Max batchsize when upserting
			 */
			upsert_max_batchsize?: number | null;
			/**
			 * Format: uint
			 * @description Max size of a collections vector storage in bytes, ignoring replicas.
			 */
			max_collection_vector_size_bytes?: number | null;
			/**
			 * Format: uint
			 * @description Max number of read operations per minute per replica
			 */
			read_rate_limit?: number | null;
			/**
			 * Format: uint
			 * @description Max number of write operations per minute per replica
			 */
			write_rate_limit?: number | null;
			/**
			 * Format: uint
			 * @description Max size of a collections payload storage in bytes
			 */
			max_collection_payload_size_bytes?: number | null;
			/**
			 * Format: uint
			 * @description Max number of points estimated in a collection
			 */
			max_points_count?: number | null;
			/**
			 * Format: uint
			 * @description Max conditions a filter can have.
			 */
			filter_max_conditions?: number | null;
			/**
			 * Format: uint
			 * @description Max size of a condition, eg. items in `MatchAny`.
			 */
			condition_max_size?: number | null;
			/** @description Multivector configuration */
			multivector_config?:
				| components["schemas"]["StrictModeMultivectorConfigOutput"]
				| (Record<string, unknown> | null);
			/** @description Sparse vector configuration */
			sparse_config?:
				| components["schemas"]["StrictModeSparseConfigOutput"]
				| (Record<string, unknown> | null);
		};
		StrictModeMultivectorConfigOutput: {
			[key: string]:
				| components["schemas"]["StrictModeMultivectorOutput"]
				| undefined;
		};
		StrictModeMultivectorOutput: {
			/**
			 * Format: uint
			 * @description Max number of vectors in a multivector
			 */
			max_vectors?: number | null;
		};
		StrictModeSparseConfigOutput: {
			[key: string]:
				| components["schemas"]["StrictModeSparseOutput"]
				| undefined;
		};
		StrictModeSparseOutput: {
			/**
			 * Format: uint
			 * @description Max length of sparse vector
			 */
			max_length?: number | null;
		};
		/** @description Display payload field type & index information */
		PayloadIndexInfo: {
			data_type: components["schemas"]["PayloadSchemaType"];
			params?:
				| components["schemas"]["PayloadSchemaParams"]
				| (Record<string, unknown> | null);
			/**
			 * Format: uint
			 * @description Number of points indexed with this index
			 */
			points: number;
		};
		/**
		 * @description All possible names of payload types
		 * @enum {string}
		 */
		PayloadSchemaType:
			| "keyword"
			| "integer"
			| "float"
			| "geo"
			| "text"
			| "bool"
			| "datetime"
			| "uuid";
		/** @description Payload type with parameters */
		PayloadSchemaParams:
			| components["schemas"]["KeywordIndexParams"]
			| components["schemas"]["IntegerIndexParams"]
			| components["schemas"]["FloatIndexParams"]
			| components["schemas"]["GeoIndexParams"]
			| components["schemas"]["TextIndexParams"]
			| components["schemas"]["BoolIndexParams"]
			| components["schemas"]["DatetimeIndexParams"]
			| components["schemas"]["UuidIndexParams"];
		KeywordIndexParams: {
			type: components["schemas"]["KeywordIndexType"];
			/** @description If true - used for tenant optimization. Default: false. */
			is_tenant?: boolean | null;
			/** @description If true, store the index on disk. Default: false. */
			on_disk?: boolean | null;
		};
		/** @enum {string} */
		KeywordIndexType: "keyword";
		IntegerIndexParams: {
			type: components["schemas"]["IntegerIndexType"];
			/** @description If true - support direct lookups. */
			lookup?: boolean | null;
			/** @description If true - support ranges filters. */
			range?: boolean | null;
			/** @description If true - use this key to organize storage of the collection data. This option assumes that this key will be used in majority of filtered requests. */
			is_principal?: boolean | null;
			/** @description If true, store the index on disk. Default: false. */
			on_disk?: boolean | null;
		};
		/** @enum {string} */
		IntegerIndexType: "integer";
		FloatIndexParams: {
			type: components["schemas"]["FloatIndexType"];
			/** @description If true - use this key to organize storage of the collection data. This option assumes that this key will be used in majority of filtered requests. */
			is_principal?: boolean | null;
			/** @description If true, store the index on disk. Default: false. */
			on_disk?: boolean | null;
		};
		/** @enum {string} */
		FloatIndexType: "float";
		GeoIndexParams: {
			type: components["schemas"]["GeoIndexType"];
			/** @description If true, store the index on disk. Default: false. */
			on_disk?: boolean | null;
		};
		/** @enum {string} */
		GeoIndexType: "geo";
		TextIndexParams: {
			type: components["schemas"]["TextIndexType"];
			tokenizer?: components["schemas"]["TokenizerType"];
			/**
			 * Format: uint
			 * @description Minimum characters to be tokenized.
			 */
			min_token_len?: number | null;
			/**
			 * Format: uint
			 * @description Maximum characters to be tokenized.
			 */
			max_token_len?: number | null;
			/** @description If true, lowercase all tokens. Default: true. */
			lowercase?: boolean | null;
			/** @description If true, store the index on disk. Default: false. */
			on_disk?: boolean | null;
		};
		/** @enum {string} */
		TextIndexType: "text";
		/** @enum {string} */
		TokenizerType: "prefix" | "whitespace" | "word" | "multilingual";
		BoolIndexParams: {
			type: components["schemas"]["BoolIndexType"];
			/** @description If true, store the index on disk. Default: false. */
			on_disk?: boolean | null;
		};
		/** @enum {string} */
		BoolIndexType: "bool";
		DatetimeIndexParams: {
			type: components["schemas"]["DatetimeIndexType"];
			/** @description If true - use this key to organize storage of the collection data. This option assumes that this key will be used in majority of filtered requests. */
			is_principal?: boolean | null;
			/** @description If true, store the index on disk. Default: false. */
			on_disk?: boolean | null;
		};
		/** @enum {string} */
		DatetimeIndexType: "datetime";
		UuidIndexParams: {
			type: components["schemas"]["UuidIndexType"];
			/** @description If true - used for tenant optimization. */
			is_tenant?: boolean | null;
			/** @description If true, store the index on disk. Default: false. */
			on_disk?: boolean | null;
		};
		/** @enum {string} */
		UuidIndexType: "uuid";
		PointRequest: {
			/** @description Specify in which shards to look for the points, if not specified - look in all shards */
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			/** @description Look for points with ids */
			ids: components["schemas"]["ExtendedPointId"][];
			/** @description Select which payload to return with the response. Default is true. */
			with_payload?:
				| components["schemas"]["WithPayloadInterface"]
				| (Record<string, unknown> | null);
			with_vector?: components["schemas"]["WithVector"];
		};
		ShardKeySelector:
			| components["schemas"]["ShardKey"]
			| components["schemas"]["ShardKey"][];
		ShardKey: string | number;
		/** @description Type, used for specifying point ID in user interface */
		ExtendedPointId: number | string;
		/** @description Options for specifying which payload to include or not */
		WithPayloadInterface:
			| boolean
			| string[]
			| components["schemas"]["PayloadSelector"];
		/** @description Specifies how to treat payload selector */
		PayloadSelector:
			| components["schemas"]["PayloadSelectorInclude"]
			| components["schemas"]["PayloadSelectorExclude"];
		PayloadSelectorInclude: {
			/** @description Only include this payload keys */
			include: string[];
		};
		PayloadSelectorExclude: {
			/** @description Exclude this fields from returning payload */
			exclude: string[];
		};
		/** @description Options for specifying which vector to include */
		WithVector: boolean | string[];
		/** @description Point data */
		Record: {
			id: components["schemas"]["ExtendedPointId"];
			/** @description Payload - values assigned to the point */
			payload?:
				| components["schemas"]["Payload"]
				| (Record<string, unknown> | null);
			/** @description Vector of the point */
			vector?:
				| components["schemas"]["VectorStructOutput"]
				| (Record<string, unknown> | null);
			/** @description Shard Key */
			shard_key?:
				| components["schemas"]["ShardKey"]
				| (Record<string, unknown> | null);
			order_value?:
				| components["schemas"]["OrderValue"]
				| (Record<string, unknown> | null);
		};
		/**
		 * @example {
		 *   "city": "London",
		 *   "color": "green"
		 * }
		 */
		Payload: {
			[key: string]: unknown;
		};
		/** @description Vector data stored in Point */
		VectorStructOutput:
			| number[]
			| number[][]
			| {
					[key: string]: components["schemas"]["VectorOutput"] | undefined;
			  };
		/** @description Vector Data stored in Point */
		VectorOutput: number[] | components["schemas"]["SparseVector"] | number[][];
		/** @description Sparse vector structure */
		SparseVector: {
			/** @description Indices must be unique */
			indices: number[];
			/** @description Values and indices must be the same length */
			values: number[];
		};
		OrderValue: number;
		/** @description Search request. Holds all conditions and parameters for the search of most similar points by vector similarity given the filtering restrictions. */
		SearchRequest: {
			/** @description Specify in which shards to look for the points, if not specified - look in all shards */
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			vector: components["schemas"]["NamedVectorStruct"];
			/** @description Look only for points which satisfies this conditions */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/** @description Additional search params */
			params?:
				| components["schemas"]["SearchParams"]
				| (Record<string, unknown> | null);
			/**
			 * Format: uint
			 * @description Max number of result to return
			 */
			limit: number;
			/**
			 * Format: uint
			 * @description Offset of the first result to return. May be used to paginate results. Note: large offset values may cause performance issues.
			 */
			offset?: number | null;
			/** @description Select which payload to return with the response. Default is false. */
			with_payload?:
				| components["schemas"]["WithPayloadInterface"]
				| (Record<string, unknown> | null);
			/**
			 * @description Options for specifying which vectors to include into response. Default is false.
			 * @default null
			 */
			with_vector?:
				| components["schemas"]["WithVector"]
				| (Record<string, unknown> | null);
			/**
			 * Format: float
			 * @description Define a minimal score threshold for the result. If defined, less similar results will not be returned. Score of the returned result might be higher or smaller than the threshold depending on the Distance function used. E.g. for cosine similarity only higher scores will be returned.
			 */
			score_threshold?: number | null;
		};
		/**
		 * @description Vector data separator for named and unnamed modes Unnamed mode:
		 *
		 * { "vector": [1.0, 2.0, 3.0] }
		 *
		 * or named mode:
		 *
		 * { "vector": { "vector": [1.0, 2.0, 3.0], "name": "image-embeddings" } }
		 */
		NamedVectorStruct:
			| number[]
			| components["schemas"]["NamedVector"]
			| components["schemas"]["NamedSparseVector"];
		/** @description Dense vector data with name */
		NamedVector: {
			/** @description Name of vector data */
			name: string;
			/** @description Vector data */
			vector: number[];
		};
		/** @description Sparse vector data with name */
		NamedSparseVector: {
			/** @description Name of vector data */
			name: string;
			vector: components["schemas"]["SparseVector"];
		};
		Filter: {
			/**
			 * @description At least one of those conditions should match
			 * @default null
			 */
			should?:
				| components["schemas"]["Condition"]
				| components["schemas"]["Condition"][]
				| (Record<string, unknown> | null);
			/** @description At least minimum amount of given conditions should match */
			min_should?:
				| components["schemas"]["MinShould"]
				| (Record<string, unknown> | null);
			/**
			 * @description All conditions must match
			 * @default null
			 */
			must?:
				| components["schemas"]["Condition"]
				| components["schemas"]["Condition"][]
				| (Record<string, unknown> | null);
			/**
			 * @description All conditions must NOT match
			 * @default null
			 */
			must_not?:
				| components["schemas"]["Condition"]
				| components["schemas"]["Condition"][]
				| (Record<string, unknown> | null);
		};
		Condition:
			| components["schemas"]["FieldCondition"]
			| components["schemas"]["IsEmptyCondition"]
			| components["schemas"]["IsNullCondition"]
			| components["schemas"]["HasIdCondition"]
			| components["schemas"]["HasVectorCondition"]
			| components["schemas"]["NestedCondition"]
			| components["schemas"]["Filter"];
		/** @description All possible payload filtering conditions */
		FieldCondition: {
			/** @description Payload key */
			key: string;
			/** @description Check if point has field with a given value */
			match?: components["schemas"]["Match"] | (Record<string, unknown> | null);
			/** @description Check if points value lies in a given range */
			range?:
				| components["schemas"]["RangeInterface"]
				| (Record<string, unknown> | null);
			/** @description Check if points geolocation lies in a given area */
			geo_bounding_box?:
				| components["schemas"]["GeoBoundingBox"]
				| (Record<string, unknown> | null);
			/** @description Check if geo point is within a given radius */
			geo_radius?:
				| components["schemas"]["GeoRadius"]
				| (Record<string, unknown> | null);
			/** @description Check if geo point is within a given polygon */
			geo_polygon?:
				| components["schemas"]["GeoPolygon"]
				| (Record<string, unknown> | null);
			/** @description Check number of values of the field */
			values_count?:
				| components["schemas"]["ValuesCount"]
				| (Record<string, unknown> | null);
			/** @description Check that the field is empty, alternative syntax for `is_empty: "field_name"` */
			is_empty?: boolean | null;
			/** @description Check that the field is null, alternative syntax for `is_null: "field_name"` */
			is_null?: boolean | null;
		};
		/** @description Match filter request */
		Match:
			| components["schemas"]["MatchValue"]
			| components["schemas"]["MatchText"]
			| components["schemas"]["MatchAny"]
			| components["schemas"]["MatchExcept"];
		/** @description Exact match of the given value */
		MatchValue: {
			value: components["schemas"]["ValueVariants"];
		};
		ValueVariants: string | number | boolean;
		/** @description Full-text match of the strings. */
		MatchText: {
			text: string;
		};
		/** @description Exact match on any of the given values */
		MatchAny: {
			any: components["schemas"]["AnyVariants"];
		};
		AnyVariants: string[] | number[];
		/** @description Should have at least one value not matching the any given values */
		MatchExcept: {
			except: components["schemas"]["AnyVariants"];
		};
		RangeInterface:
			| components["schemas"]["Range"]
			| components["schemas"]["DatetimeRange"];
		/** @description Range filter request */
		Range: {
			/**
			 * Format: double
			 * @description point.key < range.lt
			 */
			lt?: number | null;
			/**
			 * Format: double
			 * @description point.key > range.gt
			 */
			gt?: number | null;
			/**
			 * Format: double
			 * @description point.key >= range.gte
			 */
			gte?: number | null;
			/**
			 * Format: double
			 * @description point.key <= range.lte
			 */
			lte?: number | null;
		};
		/** @description Range filter request */
		DatetimeRange: {
			/**
			 * Format: date-time
			 * @description point.key < range.lt
			 */
			lt?: string | null;
			/**
			 * Format: date-time
			 * @description point.key > range.gt
			 */
			gt?: string | null;
			/**
			 * Format: date-time
			 * @description point.key >= range.gte
			 */
			gte?: string | null;
			/**
			 * Format: date-time
			 * @description point.key <= range.lte
			 */
			lte?: string | null;
		};
		/**
		 * @description Geo filter request
		 *
		 * Matches coordinates inside the rectangle, described by coordinates of lop-left and bottom-right edges
		 */
		GeoBoundingBox: {
			top_left: components["schemas"]["GeoPoint"];
			bottom_right: components["schemas"]["GeoPoint"];
		};
		/** @description Geo point payload schema */
		GeoPoint: {
			/** Format: double */
			lon: number;
			/** Format: double */
			lat: number;
		};
		/**
		 * @description Geo filter request
		 *
		 * Matches coordinates inside the circle of `radius` and center with coordinates `center`
		 */
		GeoRadius: {
			center: components["schemas"]["GeoPoint"];
			/**
			 * Format: double
			 * @description Radius of the area in meters
			 */
			radius: number;
		};
		/**
		 * @description Geo filter request
		 *
		 * Matches coordinates inside the polygon, defined by `exterior` and `interiors`
		 */
		GeoPolygon: {
			exterior: components["schemas"]["GeoLineString"];
			/** @description Interior lines (if present) bound holes within the surface each GeoLineString must consist of a minimum of 4 points, and the first and last points must be the same. */
			interiors?: components["schemas"]["GeoLineString"][] | null;
		};
		/** @description Ordered sequence of GeoPoints representing the line */
		GeoLineString: {
			points: components["schemas"]["GeoPoint"][];
		};
		/** @description Values count filter request */
		ValuesCount: {
			/**
			 * Format: uint
			 * @description point.key.length() < values_count.lt
			 */
			lt?: number | null;
			/**
			 * Format: uint
			 * @description point.key.length() > values_count.gt
			 */
			gt?: number | null;
			/**
			 * Format: uint
			 * @description point.key.length() >= values_count.gte
			 */
			gte?: number | null;
			/**
			 * Format: uint
			 * @description point.key.length() <= values_count.lte
			 */
			lte?: number | null;
		};
		/** @description Select points with empty payload for a specified field */
		IsEmptyCondition: {
			is_empty: components["schemas"]["PayloadField"];
		};
		/** @description Payload field */
		PayloadField: {
			/** @description Payload field name */
			key: string;
		};
		/** @description Select points with null payload for a specified field */
		IsNullCondition: {
			is_null: components["schemas"]["PayloadField"];
		};
		/** @description ID-based filtering condition */
		HasIdCondition: {
			has_id: components["schemas"]["ExtendedPointId"][];
		};
		/** @description Filter points which have specific vector assigned */
		HasVectorCondition: {
			has_vector: string;
		};
		NestedCondition: {
			nested: components["schemas"]["Nested"];
		};
		/** @description Select points with payload for a specified nested field */
		Nested: {
			key: string;
			filter: components["schemas"]["Filter"];
		};
		MinShould: {
			conditions: components["schemas"]["Condition"][];
			/** Format: uint */
			min_count: number;
		};
		/** @description Additional parameters of the search */
		SearchParams: {
			/**
			 * Format: uint
			 * @description Params relevant to HNSW index Size of the beam in a beam-search. Larger the value - more accurate the result, more time required for search.
			 */
			hnsw_ef?: number | null;
			/**
			 * @description Search without approximation. If set to true, search may run long but with exact results.
			 * @default false
			 */
			exact?: boolean;
			/**
			 * @description Quantization params
			 * @default null
			 */
			quantization?:
				| components["schemas"]["QuantizationSearchParams"]
				| (Record<string, unknown> | null);
			/**
			 * @description If enabled, the engine will only perform search among indexed or small segments. Using this option prevents slow searches in case of delayed index, but does not guarantee that all uploaded vectors will be included in search results
			 * @default false
			 */
			indexed_only?: boolean;
		};
		/** @description Additional parameters of the search */
		QuantizationSearchParams: {
			/**
			 * @description If true, quantized vectors are ignored. Default is false.
			 * @default false
			 */
			ignore?: boolean;
			/**
			 * @description If true, use original vectors to re-score top-k results. Might require more time in case if original vectors are stored on disk. If not set, qdrant decides automatically apply rescoring or not.
			 * @default null
			 */
			rescore?: boolean | null;
			/**
			 * Format: double
			 * @description Oversampling factor for quantization. Default is 1.0.
			 *
			 * Defines how many extra vectors should be pre-selected using quantized index, and then re-scored using original vectors.
			 *
			 * For example, if `oversampling` is 2.4 and `limit` is 100, then 240 vectors will be pre-selected using quantized index, and then top-100 will be returned after re-scoring.
			 * @default null
			 */
			oversampling?: number | null;
		};
		/** @description Search result */
		ScoredPoint: {
			id: components["schemas"]["ExtendedPointId"];
			/**
			 * Format: uint64
			 * @description Point version
			 * @example 3
			 */
			version: number;
			/**
			 * Format: float
			 * @description Points vector distance to the query vector
			 * @example 0.75
			 */
			score: number;
			/** @description Payload - values assigned to the point */
			payload?:
				| components["schemas"]["Payload"]
				| (Record<string, unknown> | null);
			/** @description Vector of the point */
			vector?:
				| components["schemas"]["VectorStructOutput"]
				| (Record<string, unknown> | null);
			/** @description Shard Key */
			shard_key?:
				| components["schemas"]["ShardKey"]
				| (Record<string, unknown> | null);
			/** @description Order-by value */
			order_value?:
				| components["schemas"]["OrderValue"]
				| (Record<string, unknown> | null);
		};
		UpdateResult: {
			/**
			 * Format: uint64
			 * @description Sequential number of the operation
			 */
			operation_id?: number | null;
			status: components["schemas"]["UpdateStatus"];
		};
		/**
		 * @description `Acknowledged` - Request is saved to WAL and will be process in a queue. `Completed` - Request is completed, changes are actual.
		 * @enum {string}
		 */
		UpdateStatus: "acknowledged" | "completed";
		/**
		 * @description Recommendation request. Provides positive and negative examples of the vectors, which can be ids of points that are already stored in the collection, raw vectors, or even ids and vectors combined.
		 *
		 * Service should look for the points which are closer to positive examples and at the same time further to negative examples. The concrete way of how to compare negative and positive distances is up to the `strategy` chosen.
		 */
		RecommendRequest: {
			/** @description Specify in which shards to look for the points, if not specified - look in all shards */
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			/**
			 * @description Look for vectors closest to those
			 * @default []
			 */
			positive?: components["schemas"]["RecommendExample"][];
			/**
			 * @description Try to avoid vectors like this
			 * @default []
			 */
			negative?: components["schemas"]["RecommendExample"][];
			/** @description How to use positive and negative examples to find the results */
			strategy?:
				| components["schemas"]["RecommendStrategy"]
				| (Record<string, unknown> | null);
			/** @description Look only for points which satisfies this conditions */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/** @description Additional search params */
			params?:
				| components["schemas"]["SearchParams"]
				| (Record<string, unknown> | null);
			/**
			 * Format: uint
			 * @description Max number of result to return
			 */
			limit: number;
			/**
			 * Format: uint
			 * @description Offset of the first result to return. May be used to paginate results. Note: large offset values may cause performance issues.
			 */
			offset?: number | null;
			/** @description Select which payload to return with the response. Default is false. */
			with_payload?:
				| components["schemas"]["WithPayloadInterface"]
				| (Record<string, unknown> | null);
			/**
			 * @description Options for specifying which vectors to include into response. Default is false.
			 * @default null
			 */
			with_vector?:
				| components["schemas"]["WithVector"]
				| (Record<string, unknown> | null);
			/**
			 * Format: float
			 * @description Define a minimal score threshold for the result. If defined, less similar results will not be returned. Score of the returned result might be higher or smaller than the threshold depending on the Distance function used. E.g. for cosine similarity only higher scores will be returned.
			 */
			score_threshold?: number | null;
			/**
			 * @description Define which vector to use for recommendation, if not specified - try to use default vector
			 * @default null
			 */
			using?:
				| components["schemas"]["UsingVector"]
				| (Record<string, unknown> | null);
			/**
			 * @description The location used to lookup vectors. If not specified - use current collection. Note: the other collection should have the same vector size as the current collection
			 * @default null
			 */
			lookup_from?:
				| components["schemas"]["LookupLocation"]
				| (Record<string, unknown> | null);
		};
		RecommendExample:
			| components["schemas"]["ExtendedPointId"]
			| number[]
			| components["schemas"]["SparseVector"];
		/**
		 * @description How to use positive and negative examples to find the results, default is `average_vector`:
		 *
		 * * `average_vector` - Average positive and negative vectors and create a single query with the formula `query = avg_pos + avg_pos - avg_neg`. Then performs normal search.
		 *
		 * * `best_score` - Uses custom search objective. Each candidate is compared against all examples, its score is then chosen from the `max(max_pos_score, max_neg_score)`. If the `max_neg_score` is chosen then it is squared and negated, otherwise it is just the `max_pos_score`.
		 *
		 * * `sum_scores` - Uses custom search objective. Compares against all inputs, sums all the scores. Scores against positive vectors are added, against negatives are subtracted.
		 * @enum {string}
		 */
		RecommendStrategy: "average_vector" | "best_score" | "sum_scores";
		UsingVector: string;
		/** @description Defines a location to use for looking up the vector. Specifies collection and vector field name. */
		LookupLocation: {
			/** @description Name of the collection used for lookup */
			collection: string;
			/**
			 * @description Optional name of the vector field within the collection. If not provided, the default vector field will be used.
			 * @default null
			 */
			vector?: string | null;
			/** @description Specify in which shards to look for the points, if not specified - look in all shards */
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
		};
		/** @description Scroll request - paginate over all points which matches given condition */
		ScrollRequest: {
			/** @description Specify in which shards to look for the points, if not specified - look in all shards */
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			/** @description Start ID to read points from. */
			offset?:
				| components["schemas"]["ExtendedPointId"]
				| (Record<string, unknown> | null);
			/**
			 * Format: uint
			 * @description Page size. Default: 10
			 */
			limit?: number | null;
			/** @description Look only for points which satisfies this conditions. If not provided - all points. */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/** @description Select which payload to return with the response. Default is true. */
			with_payload?:
				| components["schemas"]["WithPayloadInterface"]
				| (Record<string, unknown> | null);
			with_vector?: components["schemas"]["WithVector"];
			/** @description Order the records by a payload field. */
			order_by?:
				| components["schemas"]["OrderByInterface"]
				| (Record<string, unknown> | null);
		};
		OrderByInterface: string | components["schemas"]["OrderBy"];
		OrderBy: {
			/** @description Payload key to order by */
			key: string;
			/** @description Direction of ordering: `asc` or `desc`. Default is ascending. */
			direction?:
				| components["schemas"]["Direction"]
				| (Record<string, unknown> | null);
			/** @description Which payload value to start scrolling from. Default is the lowest value for `asc` and the highest for `desc` */
			start_from?:
				| components["schemas"]["StartFrom"]
				| (Record<string, unknown> | null);
		};
		/** @enum {string} */
		Direction: "asc" | "desc";
		StartFrom: number | string;
		/** @description Result of the points read request */
		ScrollResult: {
			/**
			 * @description List of retrieved points
			 * @example [
			 *   {
			 *     "id": 40,
			 *     "payload": {
			 *       "city": "London",
			 *       "color": "green"
			 *     },
			 *     "vector": [
			 *       0.875,
			 *       0.140625,
			 *       0.897599995136261
			 *     ],
			 *     "shard_key": "region_1"
			 *   },
			 *   {
			 *     "id": 41,
			 *     "payload": {
			 *       "city": "Paris",
			 *       "color": "red"
			 *     },
			 *     "vector": [
			 *       0.75,
			 *       0.640625,
			 *       0.8945000171661377
			 *     ],
			 *     "shard_key": "region_1"
			 *   }
			 * ]
			 */
			points: components["schemas"]["Record"][];
			/** @description Offset which should be used to retrieve a next page result */
			next_page_offset?:
				| components["schemas"]["ExtendedPointId"]
				| (Record<string, unknown> | null);
		};
		/** @description Operation for creating new collection and (optionally) specify index params */
		CreateCollection: {
			vectors?: components["schemas"]["VectorsConfig"];
			/**
			 * Format: uint32
			 * @description For auto sharding: Number of shards in collection. - Default is 1 for standalone, otherwise equal to the number of nodes - Minimum is 1
			 *
			 * For custom sharding: Number of shards in collection per shard group. - Default is 1, meaning that each shard key will be mapped to a single shard - Minimum is 1
			 * @default null
			 */
			shard_number?: number | null;
			/**
			 * @description Sharding method Default is Auto - points are distributed across all available shards Custom - points are distributed across shards according to shard key
			 * @default null
			 */
			sharding_method?:
				| components["schemas"]["ShardingMethod"]
				| (Record<string, unknown> | null);
			/**
			 * Format: uint32
			 * @description Number of shards replicas. Default is 1 Minimum is 1
			 * @default null
			 */
			replication_factor?: number | null;
			/**
			 * Format: uint32
			 * @description Defines how many replicas should apply the operation for us to consider it successful. Increasing this number will make the collection more resilient to inconsistencies, but will also make it fail if not enough replicas are available. Does not have any performance impact.
			 * @default null
			 */
			write_consistency_factor?: number | null;
			/**
			 * @description If true - point's payload will not be stored in memory. It will be read from the disk every time it is requested. This setting saves RAM by (slightly) increasing the response time. Note: those payload values that are involved in filtering and are indexed - remain in RAM.
			 *
			 * Default: true
			 * @default null
			 */
			on_disk_payload?: boolean | null;
			/** @description Custom params for HNSW index. If none - values from service configuration file are used. */
			hnsw_config?:
				| components["schemas"]["HnswConfigDiff"]
				| (Record<string, unknown> | null);
			/** @description Custom params for WAL. If none - values from service configuration file are used. */
			wal_config?:
				| components["schemas"]["WalConfigDiff"]
				| (Record<string, unknown> | null);
			/** @description Custom params for Optimizers.  If none - values from service configuration file are used. */
			optimizers_config?:
				| components["schemas"]["OptimizersConfigDiff"]
				| (Record<string, unknown> | null);
			/**
			 * @description Specify other collection to copy data from.
			 * @default null
			 */
			init_from?:
				| components["schemas"]["InitFrom"]
				| (Record<string, unknown> | null);
			/**
			 * @description Quantization parameters. If none - quantization is disabled.
			 * @default null
			 */
			quantization_config?:
				| components["schemas"]["QuantizationConfig"]
				| (Record<string, unknown> | null);
			/** @description Sparse vector data config. */
			sparse_vectors?: {
				[key: string]: components["schemas"]["SparseVectorParams"] | undefined;
			} | null;
			/** @description Strict-mode config. */
			strict_mode_config?:
				| components["schemas"]["StrictModeConfig"]
				| (Record<string, unknown> | null);
		};
		WalConfigDiff: {
			/**
			 * Format: uint
			 * @description Size of a single WAL segment in MB
			 */
			wal_capacity_mb?: number | null;
			/**
			 * Format: uint
			 * @description Number of WAL segments to create ahead of actually used ones
			 */
			wal_segments_ahead?: number | null;
		};
		OptimizersConfigDiff: {
			/**
			 * Format: double
			 * @description The minimal fraction of deleted vectors in a segment, required to perform segment optimization
			 */
			deleted_threshold?: number | null;
			/**
			 * Format: uint
			 * @description The minimal number of vectors in a segment, required to perform segment optimization
			 */
			vacuum_min_vector_number?: number | null;
			/**
			 * Format: uint
			 * @description Target amount of segments optimizer will try to keep. Real amount of segments may vary depending on multiple parameters: - Amount of stored points - Current write RPS
			 *
			 * It is recommended to select default number of segments as a factor of the number of search threads, so that each segment would be handled evenly by one of the threads If `default_segment_number = 0`, will be automatically selected by the number of available CPUs
			 */
			default_segment_number?: number | null;
			/**
			 * Format: uint
			 * @description Do not create segments larger this size (in kilobytes). Large segments might require disproportionately long indexation times, therefore it makes sense to limit the size of segments.
			 *
			 * If indexation speed have more priority for your - make this parameter lower. If search speed is more important - make this parameter higher. Note: 1Kb = 1 vector of size 256
			 */
			max_segment_size?: number | null;
			/**
			 * Format: uint
			 * @description Maximum size (in kilobytes) of vectors to store in-memory per segment. Segments larger than this threshold will be stored as read-only memmapped file.
			 *
			 * Memmap storage is disabled by default, to enable it, set this threshold to a reasonable value.
			 *
			 * To disable memmap storage, set this to `0`.
			 *
			 * Note: 1Kb = 1 vector of size 256
			 */
			memmap_threshold?: number | null;
			/**
			 * Format: uint
			 * @description Maximum size (in kilobytes) of vectors allowed for plain index, exceeding this threshold will enable vector indexing
			 *
			 * Default value is 20,000, based on <https://github.com/google-research/google-research/blob/master/scann/docs/algorithms.md>.
			 *
			 * To disable vector indexing, set to `0`.
			 *
			 * Note: 1kB = 1 vector of size 256.
			 */
			indexing_threshold?: number | null;
			/**
			 * Format: uint64
			 * @description Minimum interval between forced flushes.
			 */
			flush_interval_sec?: number | null;
			/** @description Max number of threads (jobs) for running optimizations per shard. Note: each optimization job will also use `max_indexing_threads` threads by itself for index building. If "auto" - have no limit and choose dynamically to saturate CPU. If 0 - no optimization threads, optimizations will be disabled. */
			max_optimization_threads?:
				| components["schemas"]["MaxOptimizationThreads"]
				| (Record<string, unknown> | null);
		};
		MaxOptimizationThreads:
			| components["schemas"]["MaxOptimizationThreadsSetting"]
			| number;
		/** @enum {string} */
		MaxOptimizationThreadsSetting: "auto";
		/** @description Operation for creating new collection and (optionally) specify index params */
		InitFrom: {
			collection: string;
		};
		StrictModeConfig: {
			/** @description Whether strict mode is enabled for a collection or not. */
			enabled?: boolean | null;
			/**
			 * Format: uint
			 * @description Max allowed `limit` parameter for all APIs that don't have their own max limit.
			 */
			max_query_limit?: number | null;
			/**
			 * Format: uint
			 * @description Max allowed `timeout` parameter.
			 */
			max_timeout?: number | null;
			/** @description Allow usage of unindexed fields in retrieval based (e.g. search) filters. */
			unindexed_filtering_retrieve?: boolean | null;
			/** @description Allow usage of unindexed fields in filtered updates (e.g. delete by payload). */
			unindexed_filtering_update?: boolean | null;
			/**
			 * Format: uint
			 * @description Max HNSW value allowed in search parameters.
			 */
			search_max_hnsw_ef?: number | null;
			/** @description Whether exact search is allowed or not. */
			search_allow_exact?: boolean | null;
			/**
			 * Format: double
			 * @description Max oversampling value allowed in search.
			 */
			search_max_oversampling?: number | null;
			/**
			 * Format: uint
			 * @description Max batchsize when upserting
			 */
			upsert_max_batchsize?: number | null;
			/**
			 * Format: uint
			 * @description Max size of a collections vector storage in bytes, ignoring replicas.
			 */
			max_collection_vector_size_bytes?: number | null;
			/**
			 * Format: uint
			 * @description Max number of read operations per minute per replica
			 */
			read_rate_limit?: number | null;
			/**
			 * Format: uint
			 * @description Max number of write operations per minute per replica
			 */
			write_rate_limit?: number | null;
			/**
			 * Format: uint
			 * @description Max size of a collections payload storage in bytes
			 */
			max_collection_payload_size_bytes?: number | null;
			/**
			 * Format: uint
			 * @description Max number of points estimated in a collection
			 */
			max_points_count?: number | null;
			/**
			 * Format: uint
			 * @description Max conditions a filter can have.
			 */
			filter_max_conditions?: number | null;
			/**
			 * Format: uint
			 * @description Max size of a condition, eg. items in `MatchAny`.
			 */
			condition_max_size?: number | null;
			/** @description Multivector configuration */
			multivector_config?:
				| components["schemas"]["StrictModeMultivectorConfig"]
				| (Record<string, unknown> | null);
			/** @description Sparse vector configuration */
			sparse_config?:
				| components["schemas"]["StrictModeSparseConfig"]
				| (Record<string, unknown> | null);
		};
		StrictModeMultivectorConfig: {
			[key: string]: components["schemas"]["StrictModeMultivector"] | undefined;
		};
		StrictModeMultivector: {
			/**
			 * Format: uint
			 * @description Max number of vectors in a multivector
			 */
			max_vectors?: number | null;
		};
		StrictModeSparseConfig: {
			[key: string]: components["schemas"]["StrictModeSparse"] | undefined;
		};
		StrictModeSparse: {
			/**
			 * Format: uint
			 * @description Max length of sparse vector
			 */
			max_length?: number | null;
		};
		/** @description Operation for updating parameters of the existing collection */
		UpdateCollection: {
			/** @description Map of vector data parameters to update for each named vector. To update parameters in a collection having a single unnamed vector, use an empty string as name. */
			vectors?:
				| components["schemas"]["VectorsConfigDiff"]
				| (Record<string, unknown> | null);
			/** @description Custom params for Optimizers.  If none - it is left unchanged. This operation is blocking, it will only proceed once all current optimizations are complete */
			optimizers_config?:
				| components["schemas"]["OptimizersConfigDiff"]
				| (Record<string, unknown> | null);
			/** @description Collection base params. If none - it is left unchanged. */
			params?:
				| components["schemas"]["CollectionParamsDiff"]
				| (Record<string, unknown> | null);
			/** @description HNSW parameters to update for the collection index. If none - it is left unchanged. */
			hnsw_config?:
				| components["schemas"]["HnswConfigDiff"]
				| (Record<string, unknown> | null);
			/**
			 * @description Quantization parameters to update. If none - it is left unchanged.
			 * @default null
			 */
			quantization_config?:
				| components["schemas"]["QuantizationConfigDiff"]
				| (Record<string, unknown> | null);
			/** @description Map of sparse vector data parameters to update for each sparse vector. */
			sparse_vectors?:
				| components["schemas"]["SparseVectorsConfig"]
				| (Record<string, unknown> | null);
			strict_mode_config?:
				| components["schemas"]["StrictModeConfig"]
				| (Record<string, unknown> | null);
		};
		/**
		 * @description Vector update params for multiple vectors
		 *
		 * { "vector_name": { "hnsw_config": { "m": 8 } } }
		 */
		VectorsConfigDiff: {
			[key: string]: components["schemas"]["VectorParamsDiff"] | undefined;
		};
		VectorParamsDiff: {
			/** @description Update params for HNSW index. If empty object - it will be unset. */
			hnsw_config?:
				| components["schemas"]["HnswConfigDiff"]
				| (Record<string, unknown> | null);
			/** @description Update params for quantization. If none - it is left unchanged. */
			quantization_config?:
				| components["schemas"]["QuantizationConfigDiff"]
				| (Record<string, unknown> | null);
			/** @description If true, vectors are served from disk, improving RAM usage at the cost of latency */
			on_disk?: boolean | null;
		};
		QuantizationConfigDiff:
			| components["schemas"]["ScalarQuantization"]
			| components["schemas"]["ProductQuantization"]
			| components["schemas"]["BinaryQuantization"]
			| components["schemas"]["Disabled"];
		/** @enum {string} */
		Disabled: "Disabled";
		CollectionParamsDiff: {
			/**
			 * Format: uint32
			 * @description Number of replicas for each shard
			 */
			replication_factor?: number | null;
			/**
			 * Format: uint32
			 * @description Minimal number successful responses from replicas to consider operation successful
			 */
			write_consistency_factor?: number | null;
			/**
			 * Format: uint32
			 * @description Fan-out every read request to these many additional remote nodes (and return first available response)
			 */
			read_fan_out_factor?: number | null;
			/**
			 * @description If true - point's payload will not be stored in memory. It will be read from the disk every time it is requested. This setting saves RAM by (slightly) increasing the response time. Note: those payload values that are involved in filtering and are indexed - remain in RAM.
			 * @default null
			 */
			on_disk_payload?: boolean | null;
		};
		SparseVectorsConfig: {
			[key: string]: components["schemas"]["SparseVectorParams"] | undefined;
		};
		/** @description Operation for performing changes of collection aliases. Alias changes are atomic, meaning that no collection modifications can happen between alias operations. */
		ChangeAliasesOperation: {
			actions: components["schemas"]["AliasOperations"][];
		};
		/** @description Group of all the possible operations related to collection aliases */
		AliasOperations:
			| components["schemas"]["CreateAliasOperation"]
			| components["schemas"]["DeleteAliasOperation"]
			| components["schemas"]["RenameAliasOperation"];
		CreateAliasOperation: {
			create_alias: components["schemas"]["CreateAlias"];
		};
		/** @description Create alternative name for a collection. Collection will be available under both names for search, retrieve, */
		CreateAlias: {
			collection_name: string;
			alias_name: string;
		};
		/** @description Delete alias if exists */
		DeleteAliasOperation: {
			delete_alias: components["schemas"]["DeleteAlias"];
		};
		/** @description Delete alias if exists */
		DeleteAlias: {
			alias_name: string;
		};
		/** @description Change alias to a new one */
		RenameAliasOperation: {
			rename_alias: components["schemas"]["RenameAlias"];
		};
		/** @description Change alias to a new one */
		RenameAlias: {
			old_alias_name: string;
			new_alias_name: string;
		};
		CreateFieldIndex: {
			field_name: string;
			field_schema?:
				| components["schemas"]["PayloadFieldSchema"]
				| (Record<string, unknown> | null);
		};
		PayloadFieldSchema:
			| components["schemas"]["PayloadSchemaType"]
			| components["schemas"]["PayloadSchemaParams"];
		PointsSelector:
			| components["schemas"]["PointIdsList"]
			| components["schemas"]["FilterSelector"];
		PointIdsList: {
			points: components["schemas"]["ExtendedPointId"][];
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
		};
		FilterSelector: {
			filter: components["schemas"]["Filter"];
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
		};
		PointInsertOperations:
			| components["schemas"]["PointsBatch"]
			| components["schemas"]["PointsList"];
		PointsBatch: {
			batch: components["schemas"]["Batch"];
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
		};
		Batch: {
			ids: components["schemas"]["ExtendedPointId"][];
			vectors: components["schemas"]["BatchVectorStruct"];
			payloads?:
				| (
						| components["schemas"]["Payload"]
						| (Record<string, unknown> | null)
				  )[]
				| null;
		};
		BatchVectorStruct:
			| number[][]
			| number[][][]
			| {
					[key: string]: components["schemas"]["Vector"][] | undefined;
			  }
			| components["schemas"]["Document"][]
			| components["schemas"]["Image"][]
			| components["schemas"]["InferenceObject"][];
		/** @description Vector Data Vectors can be described directly with values Or specified with source "objects" for inference */
		Vector:
			| number[]
			| components["schemas"]["SparseVector"]
			| number[][]
			| components["schemas"]["Document"]
			| components["schemas"]["Image"]
			| components["schemas"]["InferenceObject"];
		/**
		 * @description WARN: Work-in-progress, unimplemented
		 *
		 * Text document for embedding. Requires inference infrastructure, unimplemented.
		 */
		Document: {
			/**
			 * @description Text of the document This field will be used as input for the embedding model
			 * @example This is a document text
			 */
			text: string;
			/**
			 * @description Name of the model used to generate the vector List of available models depends on a provider
			 * @example jinaai/jina-embeddings-v2-base-en
			 */
			model: string;
			/** @description Parameters for the model Values of the parameters are model-specific */
			options?: {
				[key: string]: unknown;
			} | null;
		};
		/**
		 * @description WARN: Work-in-progress, unimplemented
		 *
		 * Image object for embedding. Requires inference infrastructure, unimplemented.
		 */
		Image: {
			/**
			 * @description Image data: base64 encoded image or an URL
			 * @example https://example.com/image.jpg
			 */
			image: unknown;
			/**
			 * @description Name of the model used to generate the vector List of available models depends on a provider
			 * @example Qdrant/clip-ViT-B-32-vision
			 */
			model: string;
			/** @description Parameters for the model Values of the parameters are model-specific */
			options?: {
				[key: string]: unknown;
			} | null;
		};
		/**
		 * @description WARN: Work-in-progress, unimplemented
		 *
		 * Custom object for embedding. Requires inference infrastructure, unimplemented.
		 */
		InferenceObject: {
			/** @description Arbitrary data, used as input for the embedding model Used if the model requires more than one input or a custom input */
			object: unknown;
			/**
			 * @description Name of the model used to generate the vector List of available models depends on a provider
			 * @example jinaai/jina-embeddings-v2-base-en
			 */
			model: string;
			/** @description Parameters for the model Values of the parameters are model-specific */
			options?: {
				[key: string]: unknown;
			} | null;
		};
		PointsList: {
			points: components["schemas"]["PointStruct"][];
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
		};
		PointStruct: {
			id: components["schemas"]["ExtendedPointId"];
			vector: components["schemas"]["VectorStruct"];
			/** @description Payload values (optional) */
			payload?:
				| components["schemas"]["Payload"]
				| (Record<string, unknown> | null);
		};
		/** @description Full vector data per point separator with single and multiple vector modes */
		VectorStruct:
			| number[]
			| number[][]
			| {
					[key: string]: components["schemas"]["Vector"] | undefined;
			  }
			| components["schemas"]["Document"]
			| components["schemas"]["Image"]
			| components["schemas"]["InferenceObject"];
		/** @description This data structure is used in API interface and applied across multiple shards */
		SetPayload: {
			payload: components["schemas"]["Payload"];
			/** @description Assigns payload to each point in this list */
			points?: components["schemas"]["ExtendedPointId"][] | null;
			/** @description Assigns payload to each point that satisfy this filter condition */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			/** @description Assigns payload to each point that satisfy this path of property */
			key?: string | null;
		};
		/** @description This data structure is used in API interface and applied across multiple shards */
		DeletePayload: {
			/** @description List of payload keys to remove from payload */
			keys: string[];
			/** @description Deletes values from each point in this list */
			points?: components["schemas"]["ExtendedPointId"][] | null;
			/** @description Deletes values from points that satisfy this filter condition */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
		};
		/** @description Information about current cluster status and structure */
		ClusterStatus: OneOf<
			[
				{
					/** @enum {string} */
					status: "disabled";
				},
				{
					/** @enum {string} */
					status: "enabled";
					/**
					 * Format: uint64
					 * @description ID of this peer
					 */
					peer_id: number;
					/** @description Peers composition of the cluster with main information */
					peers: {
						[key: string]: components["schemas"]["PeerInfo"] | undefined;
					};
					raft_info: components["schemas"]["RaftInfo"];
					consensus_thread_status: components["schemas"]["ConsensusThreadStatus"];
					/** @description Consequent failures of message send operations in consensus by peer address. On the first success to send to that peer - entry is removed from this hashmap. */
					message_send_failures: {
						[key: string]:
							| components["schemas"]["MessageSendErrors"]
							| undefined;
					};
				},
			]
		>;
		/** @description Information of a peer in the cluster */
		PeerInfo: {
			uri: string;
		};
		/** @description Summary information about the current raft state */
		RaftInfo: {
			/**
			 * Format: uint64
			 * @description Raft divides time into terms of arbitrary length, each beginning with an election. If a candidate wins the election, it remains the leader for the rest of the term. The term number increases monotonically. Each server stores the current term number which is also exchanged in every communication.
			 */
			term: number;
			/**
			 * Format: uint64
			 * @description The index of the latest committed (finalized) operation that this peer is aware of.
			 */
			commit: number;
			/**
			 * Format: uint
			 * @description Number of consensus operations pending to be applied on this peer
			 */
			pending_operations: number;
			/**
			 * Format: uint64
			 * @description Leader of the current term
			 */
			leader?: number | null;
			/** @description Role of this peer in the current term */
			role?:
				| components["schemas"]["StateRole"]
				| (Record<string, unknown> | null);
			/** @description Is this peer a voter or a learner */
			is_voter: boolean;
		};
		/**
		 * @description Role of the peer in the consensus
		 * @enum {string}
		 */
		StateRole: "Follower" | "Candidate" | "Leader" | "PreCandidate";
		/** @description Information about current consensus thread status */
		ConsensusThreadStatus: OneOf<
			[
				{
					/** @enum {string} */
					consensus_thread_status: "working";
					/** Format: date-time */
					last_update: string;
				},
				{
					/** @enum {string} */
					consensus_thread_status: "stopped";
				},
				{
					/** @enum {string} */
					consensus_thread_status: "stopped_with_err";
					err: string;
				},
			]
		>;
		/** @description Message send failures for a particular peer */
		MessageSendErrors: {
			/** Format: uint */
			count: number;
			latest_error?: string | null;
			/**
			 * Format: date-time
			 * @description Timestamp of the latest error
			 */
			latest_error_timestamp?: string | null;
		};
		/**
		 * @example {
		 *   "name": "my-collection-3766212330831337-2024-07-22-08-31-55.snapshot",
		 *   "creation_time": "2022-08-04T10:49:10",
		 *   "size": 1000000,
		 *   "checksum": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"
		 * }
		 */
		SnapshotDescription: {
			name: string;
			/** Format: partial-date-time */
			creation_time?: string | null;
			/** Format: uint64 */
			size: number;
			checksum?: string | null;
		};
		/** @description Count Request Counts the number of points which satisfy the given filter. If filter is not provided, the count of all points in the collection will be returned. */
		CountRequest: {
			/** @description Specify in which shards to look for the points, if not specified - look in all shards */
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			/** @description Look only for points which satisfies this conditions */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/**
			 * @description If true, count exact number of points. If false, count approximate number of points faster. Approximate count might be unreliable during the indexing process. Default: true
			 * @default true
			 */
			exact?: boolean;
		};
		CountResult: {
			/**
			 * Format: uint
			 * @description Number of points which satisfy the conditions
			 */
			count: number;
		};
		/** @description Current clustering distribution for the collection */
		CollectionClusterInfo: {
			/**
			 * Format: uint64
			 * @description ID of this peer
			 */
			peer_id: number;
			/**
			 * Format: uint
			 * @description Total number of shards
			 */
			shard_count: number;
			/** @description Local shards */
			local_shards: components["schemas"]["LocalShardInfo"][];
			/** @description Remote shards */
			remote_shards: components["schemas"]["RemoteShardInfo"][];
			/** @description Shard transfers */
			shard_transfers: components["schemas"]["ShardTransferInfo"][];
			/** @description Resharding operations */
			resharding_operations?: components["schemas"]["ReshardingInfo"][] | null;
		};
		LocalShardInfo: {
			/**
			 * Format: uint32
			 * @description Local shard id
			 */
			shard_id: number;
			/** @description User-defined sharding key */
			shard_key?:
				| components["schemas"]["ShardKey"]
				| (Record<string, unknown> | null);
			/**
			 * Format: uint
			 * @description Number of points in the shard
			 */
			points_count: number;
			state: components["schemas"]["ReplicaState"];
		};
		/**
		 * @description State of the single shard within a replica set.
		 * @enum {string}
		 */
		ReplicaState:
			| "Active"
			| "Dead"
			| "Partial"
			| "Initializing"
			| "Listener"
			| "PartialSnapshot"
			| "Recovery"
			| "Resharding"
			| "ReshardingScaleDown";
		RemoteShardInfo: {
			/**
			 * Format: uint32
			 * @description Remote shard id
			 */
			shard_id: number;
			/** @description User-defined sharding key */
			shard_key?:
				| components["schemas"]["ShardKey"]
				| (Record<string, unknown> | null);
			/**
			 * Format: uint64
			 * @description Remote peer id
			 */
			peer_id: number;
			state: components["schemas"]["ReplicaState"];
		};
		ShardTransferInfo: {
			/** Format: uint32 */
			shard_id: number;
			/**
			 * Format: uint32
			 * @description Target shard ID if different than source shard ID
			 *
			 * Used exclusively with `ReshardStreamRecords` transfer method.
			 */
			to_shard_id?: number | null;
			/**
			 * Format: uint64
			 * @description Source peer id
			 */
			from: number;
			/**
			 * Format: uint64
			 * @description Destination peer id
			 */
			to: number;
			/** @description If `true` transfer is a synchronization of a replicas If `false` transfer is a moving of a shard from one peer to another */
			sync: boolean;
			method?:
				| components["schemas"]["ShardTransferMethod"]
				| (Record<string, unknown> | null);
			/** @description A human-readable report of the transfer progress. Available only on the source peer. */
			comment?: string | null;
		};
		/** @description Methods for transferring a shard from one node to another. */
		ShardTransferMethod:
			| "stream_records"
			| "snapshot"
			| "wal_delta"
			| "resharding_stream_records";
		ReshardingInfo: {
			direction: components["schemas"]["ReshardingDirection"];
			/** Format: uint32 */
			shard_id: number;
			/** Format: uint64 */
			peer_id: number;
			shard_key?:
				| components["schemas"]["ShardKey"]
				| (Record<string, unknown> | null);
		};
		/** @description Resharding direction, scale up or down in number of shards */
		ReshardingDirection: "up" | "down";
		TelemetryData: {
			id: string;
			app: components["schemas"]["AppBuildTelemetry"];
			collections: components["schemas"]["CollectionsTelemetry"];
			cluster?:
				| components["schemas"]["ClusterTelemetry"]
				| (Record<string, unknown> | null);
			requests?:
				| components["schemas"]["RequestsTelemetry"]
				| (Record<string, unknown> | null);
			memory?:
				| components["schemas"]["MemoryTelemetry"]
				| (Record<string, unknown> | null);
			hardware?:
				| components["schemas"]["HardwareTelemetry"]
				| (Record<string, unknown> | null);
		};
		AppBuildTelemetry: {
			name: string;
			version: string;
			features?:
				| components["schemas"]["AppFeaturesTelemetry"]
				| (Record<string, unknown> | null);
			system?:
				| components["schemas"]["RunningEnvironmentTelemetry"]
				| (Record<string, unknown> | null);
			jwt_rbac?: boolean | null;
			hide_jwt_dashboard?: boolean | null;
			/** Format: date-time */
			startup: string;
		};
		AppFeaturesTelemetry: {
			debug: boolean;
			web_feature: boolean;
			service_debug_feature: boolean;
			recovery_mode: boolean;
			gpu: boolean;
		};
		RunningEnvironmentTelemetry: {
			distribution?: string | null;
			distribution_version?: string | null;
			is_docker: boolean;
			/** Format: uint */
			cores?: number | null;
			/** Format: uint */
			ram_size?: number | null;
			/** Format: uint */
			disk_size?: number | null;
			cpu_flags: string;
			cpu_endian?:
				| components["schemas"]["CpuEndian"]
				| (Record<string, unknown> | null);
			gpu_devices?: components["schemas"]["GpuDeviceTelemetry"][] | null;
		};
		/** @enum {string} */
		CpuEndian: "little" | "big" | "other";
		GpuDeviceTelemetry: {
			name: string;
		};
		CollectionsTelemetry: {
			/** Format: uint */
			number_of_collections: number;
			collections?: components["schemas"]["CollectionTelemetryEnum"][] | null;
		};
		CollectionTelemetryEnum:
			| components["schemas"]["CollectionTelemetry"]
			| components["schemas"]["CollectionsAggregatedTelemetry"];
		CollectionTelemetry: {
			id: string;
			/** Format: uint64 */
			init_time_ms: number;
			config: components["schemas"]["CollectionConfigTelemetry"];
			shards?: components["schemas"]["ReplicaSetTelemetry"][] | null;
			transfers?: components["schemas"]["ShardTransferInfo"][] | null;
			resharding?: components["schemas"]["ReshardingInfo"][] | null;
			shard_clean_tasks?: {
				[key: string]:
					| components["schemas"]["ShardCleanStatusTelemetry"]
					| undefined;
			} | null;
		};
		CollectionConfigTelemetry: {
			params: components["schemas"]["CollectionParams"];
			hnsw_config: components["schemas"]["HnswConfig"];
			optimizer_config: components["schemas"]["OptimizersConfig"];
			wal_config: components["schemas"]["WalConfig"];
			/** @default null */
			quantization_config?:
				| components["schemas"]["QuantizationConfig"]
				| (Record<string, unknown> | null);
			strict_mode_config?:
				| components["schemas"]["StrictModeConfigOutput"]
				| (Record<string, unknown> | null);
			/**
			 * Format: uuid
			 * @default null
			 */
			uuid?: string | null;
		};
		ReplicaSetTelemetry: {
			/** Format: uint32 */
			id: number;
			key?:
				| components["schemas"]["ShardKey"]
				| (Record<string, unknown> | null);
			local?:
				| components["schemas"]["LocalShardTelemetry"]
				| (Record<string, unknown> | null);
			remote: components["schemas"]["RemoteShardTelemetry"][];
			replicate_states: {
				[key: string]: components["schemas"]["ReplicaState"] | undefined;
			};
		};
		LocalShardTelemetry: {
			variant_name?: string | null;
			status?:
				| components["schemas"]["ShardStatus"]
				| (Record<string, unknown> | null);
			/**
			 * Format: uint
			 * @description Total number of optimized points since the last start.
			 */
			total_optimized_points: number;
			/**
			 * Format: uint
			 * @description An ESTIMATION of effective amount of bytes used for vectors Do NOT rely on this number unless you know what you are doing
			 */
			vectors_size_bytes?: number | null;
			/**
			 * Format: uint
			 * @description An estimation of the effective amount of bytes used for payloads Do NOT rely on this number unless you know what you are doing
			 */
			payloads_size_bytes?: number | null;
			/**
			 * Format: uint
			 * @description Sum of segment points This is an approximate number Do NOT rely on this number unless you know what you are doing
			 */
			num_points?: number | null;
			/**
			 * Format: uint
			 * @description Sum of number of vectors in all segments This is an approximate number Do NOT rely on this number unless you know what you are doing
			 */
			num_vectors?: number | null;
			segments?: components["schemas"]["SegmentTelemetry"][] | null;
			optimizations: components["schemas"]["OptimizerTelemetry"];
			async_scorer?: boolean | null;
		};
		/**
		 * @description Current state of the shard (supports same states as the collection)
		 *
		 * `Green` - all good. `Yellow` - optimization is running, 'Grey' - optimizations are possible but not triggered, `Red` - some operations failed and was not recovered
		 * @enum {string}
		 */
		ShardStatus: "green" | "yellow" | "grey" | "red";
		SegmentTelemetry: {
			info: components["schemas"]["SegmentInfo"];
			config: components["schemas"]["SegmentConfig"];
			vector_index_searches: components["schemas"]["VectorIndexSearchesTelemetry"][];
			payload_field_indices: components["schemas"]["PayloadIndexTelemetry"][];
		};
		/** @description Aggregated information about segment */
		SegmentInfo: {
			segment_type: components["schemas"]["SegmentType"];
			/** Format: uint */
			num_vectors: number;
			/** Format: uint */
			num_points: number;
			/** Format: uint */
			num_indexed_vectors: number;
			/** Format: uint */
			num_deleted_vectors: number;
			/**
			 * Format: uint
			 * @description An ESTIMATION of effective amount of bytes used for vectors Do NOT rely on this number unless you know what you are doing
			 */
			vectors_size_bytes: number;
			/**
			 * Format: uint
			 * @description An estimation of the effective amount of bytes used for payloads
			 */
			payloads_size_bytes: number;
			/** Format: uint */
			ram_usage_bytes: number;
			/** Format: uint */
			disk_usage_bytes: number;
			is_appendable: boolean;
			index_schema: {
				[key: string]: components["schemas"]["PayloadIndexInfo"] | undefined;
			};
			vector_data: {
				[key: string]: components["schemas"]["VectorDataInfo"] | undefined;
			};
		};
		/**
		 * @description Type of segment
		 * @enum {string}
		 */
		SegmentType: "plain" | "indexed" | "special";
		VectorDataInfo: {
			/** Format: uint */
			num_vectors: number;
			/** Format: uint */
			num_indexed_vectors: number;
			/** Format: uint */
			num_deleted_vectors: number;
		};
		SegmentConfig: {
			/** @default {} */
			vector_data?: {
				[key: string]: components["schemas"]["VectorDataConfig"] | undefined;
			};
			sparse_vector_data?: {
				[key: string]:
					| components["schemas"]["SparseVectorDataConfig"]
					| undefined;
			};
			payload_storage_type: components["schemas"]["PayloadStorageType"];
		};
		/** @description Config of single vector data storage */
		VectorDataConfig: {
			/**
			 * Format: uint
			 * @description Size/dimensionality of the vectors used
			 */
			size: number;
			distance: components["schemas"]["Distance"];
			storage_type: components["schemas"]["VectorStorageType"];
			index: components["schemas"]["Indexes"];
			/** @description Vector specific quantization config that overrides collection config */
			quantization_config?:
				| components["schemas"]["QuantizationConfig"]
				| (Record<string, unknown> | null);
			/** @description Vector specific configuration to enable multiple vectors per point */
			multivector_config?:
				| components["schemas"]["MultiVectorConfig"]
				| (Record<string, unknown> | null);
			/** @description Vector specific configuration to set specific storage element type */
			datatype?:
				| components["schemas"]["VectorStorageDatatype"]
				| (Record<string, unknown> | null);
		};
		/** @description Storage types for vectors */
		VectorStorageType: "Memory" | "Mmap" | "ChunkedMmap" | "InRamChunkedMmap";
		/** @description Vector index configuration */
		Indexes: OneOf<
			[
				{
					/** @enum {string} */
					type: "plain";
					options: Record<string, never>;
				},
				{
					/** @enum {string} */
					type: "hnsw";
					options: components["schemas"]["HnswConfig"];
				},
			]
		>;
		/**
		 * @description Storage types for vectors
		 * @enum {string}
		 */
		VectorStorageDatatype: "float32" | "float16" | "uint8";
		/** @description Config of single sparse vector data storage */
		SparseVectorDataConfig: {
			index: components["schemas"]["SparseIndexConfig"];
			storage_type?: components["schemas"]["SparseVectorStorageType"];
		};
		/** @description Configuration for sparse inverted index. */
		SparseIndexConfig: {
			/**
			 * Format: uint
			 * @description We prefer a full scan search upto (excluding) this number of vectors.
			 *
			 * Note: this is number of vectors, not KiloBytes.
			 */
			full_scan_threshold?: number | null;
			index_type: components["schemas"]["SparseIndexType"];
			/** @description Datatype used to store weights in the index. */
			datatype?:
				| components["schemas"]["VectorStorageDatatype"]
				| (Record<string, unknown> | null);
		};
		/** @description Sparse index types */
		SparseIndexType: "MutableRam" | "ImmutableRam" | "Mmap";
		SparseVectorStorageType: "on_disk" | "mmap";
		/** @description Type of payload storage */
		PayloadStorageType: OneOf<
			[
				{
					/** @enum {string} */
					type: "in_memory";
				},
				{
					/** @enum {string} */
					type: "on_disk";
				},
				{
					/** @enum {string} */
					type: "mmap";
				},
			]
		>;
		VectorIndexSearchesTelemetry: {
			index_name?: string | null;
			unfiltered_plain: components["schemas"]["OperationDurationStatistics"];
			unfiltered_hnsw: components["schemas"]["OperationDurationStatistics"];
			unfiltered_sparse: components["schemas"]["OperationDurationStatistics"];
			filtered_plain: components["schemas"]["OperationDurationStatistics"];
			filtered_small_cardinality: components["schemas"]["OperationDurationStatistics"];
			filtered_large_cardinality: components["schemas"]["OperationDurationStatistics"];
			filtered_exact: components["schemas"]["OperationDurationStatistics"];
			filtered_sparse: components["schemas"]["OperationDurationStatistics"];
			unfiltered_exact: components["schemas"]["OperationDurationStatistics"];
		};
		OperationDurationStatistics: {
			/** Format: uint */
			count: number;
			/** Format: uint */
			fail_count?: number | null;
			/**
			 * Format: float
			 * @description The average time taken by 128 latest operations, calculated as a weighted mean.
			 */
			avg_duration_micros?: number | null;
			/**
			 * Format: float
			 * @description The minimum duration of the operations across all the measurements.
			 */
			min_duration_micros?: number | null;
			/**
			 * Format: float
			 * @description The maximum duration of the operations across all the measurements.
			 */
			max_duration_micros?: number | null;
			/**
			 * Format: uint64
			 * @description The total duration of all operations in microseconds.
			 */
			total_duration_micros?: number | null;
			/** Format: date-time */
			last_responded?: string | null;
		};
		PayloadIndexTelemetry: {
			field_name?: string | null;
			index_type: string;
			/**
			 * Format: uint
			 * @description The amount of values indexed for all points.
			 */
			points_values_count: number;
			/**
			 * Format: uint
			 * @description The amount of points that have at least one value indexed.
			 */
			points_count: number;
			/** Format: uint */
			histogram_bucket_size?: number | null;
		};
		OptimizerTelemetry: {
			status: components["schemas"]["OptimizersStatus"];
			optimizations: components["schemas"]["OperationDurationStatistics"];
			log?: components["schemas"]["TrackerTelemetry"][] | null;
		};
		/** @description Tracker object used in telemetry */
		TrackerTelemetry: {
			/** @description Name of the optimizer */
			name: string;
			/** @description Segment IDs being optimized */
			segment_ids: number[];
			status: components["schemas"]["TrackerStatus"];
			/**
			 * Format: date-time
			 * @description Start time of the optimizer
			 */
			start_at: string;
			/**
			 * Format: date-time
			 * @description End time of the optimizer
			 */
			end_at?: string | null;
		};
		/** @description Represents the current state of the optimizer being tracked */
		TrackerStatus: OneOf<
			[
				"optimizing" | "done",
				{
					cancelled: string;
				},
				{
					error: string;
				},
			]
		>;
		RemoteShardTelemetry: {
			/** Format: uint32 */
			shard_id: number;
			/** Format: uint64 */
			peer_id?: number | null;
			searches: components["schemas"]["OperationDurationStatistics"];
			updates: components["schemas"]["OperationDurationStatistics"];
		};
		ShardCleanStatusTelemetry: OneOf<
			[
				"started" | "done" | "cancelled",
				{
					progress: components["schemas"]["ShardCleanStatusProgressTelemetry"];
				},
				{
					failed: components["schemas"]["ShardCleanStatusFailedTelemetry"];
				},
			]
		>;
		ShardCleanStatusProgressTelemetry: {
			/** Format: uint */
			deleted_points: number;
		};
		ShardCleanStatusFailedTelemetry: {
			reason: string;
		};
		CollectionsAggregatedTelemetry: {
			/** Format: uint */
			vectors: number;
			optimizers_status: components["schemas"]["OptimizersStatus"];
			params: components["schemas"]["CollectionParams"];
		};
		ClusterTelemetry: {
			enabled: boolean;
			status?:
				| components["schemas"]["ClusterStatusTelemetry"]
				| (Record<string, unknown> | null);
			config?:
				| components["schemas"]["ClusterConfigTelemetry"]
				| (Record<string, unknown> | null);
			peers?: {
				[key: string]: components["schemas"]["PeerInfo"] | undefined;
			} | null;
			metadata?: {
				[key: string]: unknown;
			} | null;
		};
		ClusterStatusTelemetry: {
			/** Format: uint */
			number_of_peers: number;
			/** Format: uint64 */
			term: number;
			/** Format: uint64 */
			commit: number;
			/** Format: uint */
			pending_operations: number;
			role?:
				| components["schemas"]["StateRole"]
				| (Record<string, unknown> | null);
			is_voter: boolean;
			/** Format: uint64 */
			peer_id?: number | null;
			consensus_thread_status: components["schemas"]["ConsensusThreadStatus"];
		};
		ClusterConfigTelemetry: {
			/** Format: uint64 */
			grpc_timeout_ms: number;
			p2p: components["schemas"]["P2pConfigTelemetry"];
			consensus: components["schemas"]["ConsensusConfigTelemetry"];
		};
		P2pConfigTelemetry: {
			/** Format: uint */
			connection_pool_size: number;
		};
		ConsensusConfigTelemetry: {
			/** Format: uint */
			max_message_queue_size: number;
			/** Format: uint64 */
			tick_period_ms: number;
			/** Format: uint64 */
			bootstrap_timeout_sec: number;
		};
		RequestsTelemetry: {
			rest: components["schemas"]["WebApiTelemetry"];
			grpc: components["schemas"]["GrpcTelemetry"];
		};
		WebApiTelemetry: {
			responses: {
				[key: string]:
					| {
							[key: string]:
								| components["schemas"]["OperationDurationStatistics"]
								| undefined;
					  }
					| undefined;
			};
		};
		GrpcTelemetry: {
			responses: {
				[key: string]:
					| components["schemas"]["OperationDurationStatistics"]
					| undefined;
			};
		};
		MemoryTelemetry: {
			/**
			 * Format: uint
			 * @description Total number of bytes in active pages allocated by the application
			 */
			active_bytes: number;
			/**
			 * Format: uint
			 * @description Total number of bytes allocated by the application
			 */
			allocated_bytes: number;
			/**
			 * Format: uint
			 * @description Total number of bytes dedicated to metadata
			 */
			metadata_bytes: number;
			/**
			 * Format: uint
			 * @description Maximum number of bytes in physically resident data pages mapped
			 */
			resident_bytes: number;
			/**
			 * Format: uint
			 * @description Total number of bytes in virtual memory mappings
			 */
			retained_bytes: number;
		};
		HardwareTelemetry: {
			collection_data: {
				[key: string]: components["schemas"]["HardwareUsage"] | undefined;
			};
		};
		/** @description Usage of the hardware resources, spent to process the request */
		HardwareUsage: {
			/** Format: uint */
			cpu: number;
			/** Format: uint */
			payload_io_read: number;
			/** Format: uint */
			payload_io_write: number;
			/** Format: uint */
			payload_index_io_read: number;
			/** Format: uint */
			payload_index_io_write: number;
			/** Format: uint */
			vector_io_read: number;
			/** Format: uint */
			vector_io_write: number;
		};
		ClusterOperations:
			| components["schemas"]["MoveShardOperation"]
			| components["schemas"]["ReplicateShardOperation"]
			| components["schemas"]["AbortTransferOperation"]
			| components["schemas"]["DropReplicaOperation"]
			| components["schemas"]["CreateShardingKeyOperation"]
			| components["schemas"]["DropShardingKeyOperation"]
			| components["schemas"]["RestartTransferOperation"]
			| components["schemas"]["StartReshardingOperation"]
			| components["schemas"]["AbortReshardingOperation"];
		MoveShardOperation: {
			move_shard: components["schemas"]["MoveShard"];
		};
		MoveShard: {
			/** Format: uint32 */
			shard_id: number;
			/** Format: uint64 */
			to_peer_id: number;
			/** Format: uint64 */
			from_peer_id: number;
			/** @description Method for transferring the shard from one node to another */
			method?:
				| components["schemas"]["ShardTransferMethod"]
				| (Record<string, unknown> | null);
		};
		ReplicateShardOperation: {
			replicate_shard: components["schemas"]["ReplicateShard"];
		};
		ReplicateShard: {
			/** Format: uint32 */
			shard_id: number;
			/** Format: uint64 */
			to_peer_id: number;
			/** Format: uint64 */
			from_peer_id: number;
			/** @description Method for transferring the shard from one node to another */
			method?:
				| components["schemas"]["ShardTransferMethod"]
				| (Record<string, unknown> | null);
		};
		AbortTransferOperation: {
			abort_transfer: components["schemas"]["AbortShardTransfer"];
		};
		AbortShardTransfer: {
			/** Format: uint32 */
			shard_id: number;
			/** Format: uint64 */
			to_peer_id: number;
			/** Format: uint64 */
			from_peer_id: number;
		};
		DropReplicaOperation: {
			drop_replica: components["schemas"]["Replica"];
		};
		Replica: {
			/** Format: uint32 */
			shard_id: number;
			/** Format: uint64 */
			peer_id: number;
		};
		CreateShardingKeyOperation: {
			create_sharding_key: components["schemas"]["CreateShardingKey"];
		};
		CreateShardingKey: {
			shard_key: components["schemas"]["ShardKey"];
			/**
			 * Format: uint32
			 * @description How many shards to create for this key If not specified, will use the default value from config
			 */
			shards_number?: number | null;
			/**
			 * Format: uint32
			 * @description How many replicas to create for each shard If not specified, will use the default value from config
			 */
			replication_factor?: number | null;
			/** @description Placement of shards for this key List of peer ids, that can be used to place shards for this key If not specified, will be randomly placed among all peers */
			placement?: number[] | null;
		};
		DropShardingKeyOperation: {
			drop_sharding_key: components["schemas"]["DropShardingKey"];
		};
		DropShardingKey: {
			shard_key: components["schemas"]["ShardKey"];
		};
		RestartTransferOperation: {
			restart_transfer: components["schemas"]["RestartTransfer"];
		};
		RestartTransfer: {
			/** Format: uint32 */
			shard_id: number;
			/** Format: uint64 */
			from_peer_id: number;
			/** Format: uint64 */
			to_peer_id: number;
			method: components["schemas"]["ShardTransferMethod"];
		};
		StartReshardingOperation: {
			start_resharding: components["schemas"]["StartResharding"];
		};
		StartResharding: {
			direction: components["schemas"]["ReshardingDirection"];
			/** Format: uint64 */
			peer_id?: number | null;
			shard_key?:
				| components["schemas"]["ShardKey"]
				| (Record<string, unknown> | null);
		};
		AbortReshardingOperation: {
			abort_resharding: components["schemas"]["AbortResharding"];
		};
		AbortResharding: Record<string, never>;
		SearchRequestBatch: {
			searches: components["schemas"]["SearchRequest"][];
		};
		RecommendRequestBatch: {
			searches: components["schemas"]["RecommendRequest"][];
		};
		LocksOption: {
			error_message?: string | null;
			write: boolean;
		};
		SnapshotRecover: {
			/**
			 * Format: uri
			 * @description Examples: - URL `http://localhost:8080/collections/my_collection/snapshots/my_snapshot` - Local path `file:///qdrant/snapshots/test_collection-2022-08-04-10-49-10.snapshot`
			 */
			location: string;
			/**
			 * @description Defines which data should be used as a source of truth if there are other replicas in the cluster. If set to `Snapshot`, the snapshot will be used as a source of truth, and the current state will be overwritten. If set to `Replica`, the current state will be used as a source of truth, and after recovery if will be synchronized with the snapshot.
			 * @default null
			 */
			priority?:
				| components["schemas"]["SnapshotPriority"]
				| (Record<string, unknown> | null);
			/**
			 * @description Optional SHA256 checksum to verify snapshot integrity before recovery.
			 * @default null
			 */
			checksum?: string | null;
			/**
			 * @description Optional API key used when fetching the snapshot from a remote URL.
			 * @default null
			 */
			api_key?: string | null;
		};
		/**
		 * @description Defines source of truth for snapshot recovery:
		 *
		 * `NoSync` means - restore snapshot without *any* additional synchronization. `Snapshot` means - prefer snapshot data over the current state. `Replica` means - prefer existing data over the snapshot.
		 * @enum {string}
		 */
		SnapshotPriority: "no_sync" | "snapshot" | "replica";
		CollectionsAliasesResponse: {
			aliases: components["schemas"]["AliasDescription"][];
		};
		/**
		 * @example {
		 *   "alias_name": "blogs-title",
		 *   "collection_name": "arivx-title"
		 * }
		 */
		AliasDescription: {
			alias_name: string;
			collection_name: string;
		};
		/**
		 * @description Defines write ordering guarantees for collection operations
		 *
		 * * `weak` - write operations may be reordered, works faster, default
		 *
		 * * `medium` - write operations go through dynamically selected leader, may be inconsistent for a short period of time in case of leader change
		 *
		 * * `strong` - Write operations go through the permanent leader, consistent, but may be unavailable if leader is down
		 * @enum {string}
		 */
		WriteOrdering: "weak" | "medium" | "strong";
		/**
		 * @description Read consistency parameter
		 *
		 * Defines how many replicas should be queried to get the result
		 *
		 * * `N` - send N random request and return points, which present on all of them
		 *
		 * * `majority` - send N/2+1 random request and return points, which present on all of them
		 *
		 * * `quorum` - send requests to all nodes and return points which present on majority of them
		 *
		 * * `all` - send requests to all nodes and return points which present on all of them
		 *
		 * Default value is `Factor(1)`
		 */
		ReadConsistency: number | components["schemas"]["ReadConsistencyType"];
		/**
		 * @description * `majority` - send N/2+1 random request and return points, which present on all of them
		 *
		 * * `quorum` - send requests to all nodes and return points which present on majority of nodes
		 *
		 * * `all` - send requests to all nodes and return points which present on all nodes
		 * @enum {string}
		 */
		ReadConsistencyType: "majority" | "quorum" | "all";
		UpdateVectors: {
			/** @description Points with named vectors */
			points: components["schemas"]["PointVectors"][];
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
		};
		PointVectors: {
			id: components["schemas"]["ExtendedPointId"];
			vector: components["schemas"]["VectorStruct"];
		};
		DeleteVectors: {
			/** @description Deletes values from each point in this list */
			points?: components["schemas"]["ExtendedPointId"][] | null;
			/** @description Deletes values from points that satisfy this filter condition */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/** @description Vector names */
			vector: string[];
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
		};
		PointGroup: {
			/** @description Scored points that have the same value of the group_by key */
			hits: components["schemas"]["ScoredPoint"][];
			id: components["schemas"]["GroupId"];
			/** @description Record that has been looked up using the group id */
			lookup?:
				| components["schemas"]["Record"]
				| (Record<string, unknown> | null);
		};
		/** @description Value of the group_by key, shared across all the hits in the group */
		GroupId: string | number;
		SearchGroupsRequest: {
			/** @description Specify in which shards to look for the points, if not specified - look in all shards */
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			vector: components["schemas"]["NamedVectorStruct"];
			/** @description Look only for points which satisfies this conditions */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/** @description Additional search params */
			params?:
				| components["schemas"]["SearchParams"]
				| (Record<string, unknown> | null);
			/** @description Select which payload to return with the response. Default is false. */
			with_payload?:
				| components["schemas"]["WithPayloadInterface"]
				| (Record<string, unknown> | null);
			/**
			 * @description Options for specifying which vectors to include into response. Default is false.
			 * @default null
			 */
			with_vector?:
				| components["schemas"]["WithVector"]
				| (Record<string, unknown> | null);
			/**
			 * Format: float
			 * @description Define a minimal score threshold for the result. If defined, less similar results will not be returned. Score of the returned result might be higher or smaller than the threshold depending on the Distance function used. E.g. for cosine similarity only higher scores will be returned.
			 */
			score_threshold?: number | null;
			/** @description Payload field to group by, must be a string or number field. If the field contains more than 1 value, all values will be used for grouping. One point can be in multiple groups. */
			group_by: string;
			/**
			 * Format: uint32
			 * @description Maximum amount of points to return per group
			 */
			group_size: number;
			/**
			 * Format: uint32
			 * @description Maximum amount of groups to return
			 */
			limit: number;
			/** @description Look for points in another collection using the group ids */
			with_lookup?:
				| components["schemas"]["WithLookupInterface"]
				| (Record<string, unknown> | null);
		};
		WithLookupInterface: string | components["schemas"]["WithLookup"];
		WithLookup: {
			/** @description Name of the collection to use for points lookup */
			collection: string;
			/**
			 * @description Options for specifying which payload to include (or not)
			 * @default true
			 */
			with_payload?:
				| components["schemas"]["WithPayloadInterface"]
				| (Record<string, unknown> | null);
			/**
			 * @description Options for specifying which vectors to include (or not)
			 * @default null
			 */
			with_vectors?:
				| components["schemas"]["WithVector"]
				| (Record<string, unknown> | null);
		};
		RecommendGroupsRequest: {
			/** @description Specify in which shards to look for the points, if not specified - look in all shards */
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			/**
			 * @description Look for vectors closest to those
			 * @default []
			 */
			positive?: components["schemas"]["RecommendExample"][];
			/**
			 * @description Try to avoid vectors like this
			 * @default []
			 */
			negative?: components["schemas"]["RecommendExample"][];
			/**
			 * @description How to use positive and negative examples to find the results
			 * @default null
			 */
			strategy?:
				| components["schemas"]["RecommendStrategy"]
				| (Record<string, unknown> | null);
			/** @description Look only for points which satisfies this conditions */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/** @description Additional search params */
			params?:
				| components["schemas"]["SearchParams"]
				| (Record<string, unknown> | null);
			/** @description Select which payload to return with the response. Default is false. */
			with_payload?:
				| components["schemas"]["WithPayloadInterface"]
				| (Record<string, unknown> | null);
			/**
			 * @description Options for specifying which vectors to include into response. Default is false.
			 * @default null
			 */
			with_vector?:
				| components["schemas"]["WithVector"]
				| (Record<string, unknown> | null);
			/**
			 * Format: float
			 * @description Define a minimal score threshold for the result. If defined, less similar results will not be returned. Score of the returned result might be higher or smaller than the threshold depending on the Distance function used. E.g. for cosine similarity only higher scores will be returned.
			 */
			score_threshold?: number | null;
			/**
			 * @description Define which vector to use for recommendation, if not specified - try to use default vector
			 * @default null
			 */
			using?:
				| components["schemas"]["UsingVector"]
				| (Record<string, unknown> | null);
			/**
			 * @description The location used to lookup vectors. If not specified - use current collection. Note: the other collection should have the same vector size as the current collection
			 * @default null
			 */
			lookup_from?:
				| components["schemas"]["LookupLocation"]
				| (Record<string, unknown> | null);
			/** @description Payload field to group by, must be a string or number field. If the field contains more than 1 value, all values will be used for grouping. One point can be in multiple groups. */
			group_by: string;
			/**
			 * Format: uint32
			 * @description Maximum amount of points to return per group
			 */
			group_size: number;
			/**
			 * Format: uint32
			 * @description Maximum amount of groups to return
			 */
			limit: number;
			/** @description Look for points in another collection using the group ids */
			with_lookup?:
				| components["schemas"]["WithLookupInterface"]
				| (Record<string, unknown> | null);
		};
		GroupsResult: {
			groups: components["schemas"]["PointGroup"][];
		};
		UpdateOperations: {
			operations: components["schemas"]["UpdateOperation"][];
		};
		UpdateOperation:
			| components["schemas"]["UpsertOperation"]
			| components["schemas"]["DeleteOperation"]
			| components["schemas"]["SetPayloadOperation"]
			| components["schemas"]["OverwritePayloadOperation"]
			| components["schemas"]["DeletePayloadOperation"]
			| components["schemas"]["ClearPayloadOperation"]
			| components["schemas"]["UpdateVectorsOperation"]
			| components["schemas"]["DeleteVectorsOperation"];
		UpsertOperation: {
			upsert: components["schemas"]["PointInsertOperations"];
		};
		DeleteOperation: {
			delete: components["schemas"]["PointsSelector"];
		};
		SetPayloadOperation: {
			set_payload: components["schemas"]["SetPayload"];
		};
		OverwritePayloadOperation: {
			overwrite_payload: components["schemas"]["SetPayload"];
		};
		DeletePayloadOperation: {
			delete_payload: components["schemas"]["DeletePayload"];
		};
		ClearPayloadOperation: {
			clear_payload: components["schemas"]["PointsSelector"];
		};
		UpdateVectorsOperation: {
			update_vectors: components["schemas"]["UpdateVectors"];
		};
		DeleteVectorsOperation: {
			delete_vectors: components["schemas"]["DeleteVectors"];
		};
		ShardSnapshotRecover: {
			location: components["schemas"]["ShardSnapshotLocation"];
			/** @default null */
			priority?:
				| components["schemas"]["SnapshotPriority"]
				| (Record<string, unknown> | null);
			/**
			 * @description Optional SHA256 checksum to verify snapshot integrity before recovery.
			 * @default null
			 */
			checksum?: string | null;
			/**
			 * @description Optional API key used when fetching the snapshot from a remote URL.
			 * @default null
			 */
			api_key?: string | null;
		};
		ShardSnapshotLocation: string;
		/** @description Use context and a target to find the most similar points, constrained by the context. */
		DiscoverRequest: {
			/** @description Specify in which shards to look for the points, if not specified - look in all shards */
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			/**
			 * @description Look for vectors closest to this.
			 *
			 * When using the target (with or without context), the integer part of the score represents the rank with respect to the context, while the decimal part of the score relates to the distance to the target.
			 */
			target?:
				| components["schemas"]["RecommendExample"]
				| (Record<string, unknown> | null);
			/**
			 * @description Pairs of { positive, negative } examples to constrain the search.
			 *
			 * When using only the context (without a target), a special search - called context search - is performed where pairs of points are used to generate a loss that guides the search towards the zone where most positive examples overlap. This means that the score minimizes the scenario of finding a point closer to a negative than to a positive part of a pair.
			 *
			 * Since the score of a context relates to loss, the maximum score a point can get is 0.0, and it becomes normal that many points can have a score of 0.0.
			 *
			 * For discovery search (when including a target), the context part of the score for each pair is calculated +1 if the point is closer to a positive than to a negative part of a pair, and -1 otherwise.
			 */
			context?: components["schemas"]["ContextExamplePair"][] | null;
			/** @description Look only for points which satisfies this conditions */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/** @description Additional search params */
			params?:
				| components["schemas"]["SearchParams"]
				| (Record<string, unknown> | null);
			/**
			 * Format: uint
			 * @description Max number of result to return
			 */
			limit: number;
			/**
			 * Format: uint
			 * @description Offset of the first result to return. May be used to paginate results. Note: large offset values may cause performance issues.
			 */
			offset?: number | null;
			/** @description Select which payload to return with the response. Default is false. */
			with_payload?:
				| components["schemas"]["WithPayloadInterface"]
				| (Record<string, unknown> | null);
			/** @description Options for specifying which vectors to include into response. Default is false. */
			with_vector?:
				| components["schemas"]["WithVector"]
				| (Record<string, unknown> | null);
			/**
			 * @description Define which vector to use for recommendation, if not specified - try to use default vector
			 * @default null
			 */
			using?:
				| components["schemas"]["UsingVector"]
				| (Record<string, unknown> | null);
			/**
			 * @description The location used to lookup vectors. If not specified - use current collection. Note: the other collection should have the same vector size as the current collection
			 * @default null
			 */
			lookup_from?:
				| components["schemas"]["LookupLocation"]
				| (Record<string, unknown> | null);
		};
		ContextExamplePair: {
			positive: components["schemas"]["RecommendExample"];
			negative: components["schemas"]["RecommendExample"];
		};
		DiscoverRequestBatch: {
			searches: components["schemas"]["DiscoverRequest"][];
		};
		VersionInfo: {
			title: string;
			version: string;
			commit?: string | null;
		};
		/** @description State of existence of a collection, true = exists, false = does not exist */
		CollectionExistence: {
			exists: boolean;
		};
		QueryRequest: {
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			/**
			 * @description Sub-requests to perform first. If present, the query will be performed on the results of the prefetch(es).
			 * @default null
			 */
			prefetch?:
				| components["schemas"]["Prefetch"]
				| components["schemas"]["Prefetch"][]
				| (Record<string, unknown> | null);
			/** @description Query to perform. If missing without prefetches, returns points ordered by their IDs. */
			query?:
				| components["schemas"]["QueryInterface"]
				| (Record<string, unknown> | null);
			/** @description Define which vector name to use for querying. If missing, the default vector is used. */
			using?: string | null;
			/** @description Filter conditions - return only those points that satisfy the specified conditions. */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/** @description Search params for when there is no prefetch */
			params?:
				| components["schemas"]["SearchParams"]
				| (Record<string, unknown> | null);
			/**
			 * Format: float
			 * @description Return points with scores better than this threshold.
			 */
			score_threshold?: number | null;
			/**
			 * Format: uint
			 * @description Max number of points to return. Default is 10.
			 */
			limit?: number | null;
			/**
			 * Format: uint
			 * @description Offset of the result. Skip this many points. Default is 0
			 */
			offset?: number | null;
			/** @description Options for specifying which vectors to include into the response. Default is false. */
			with_vector?:
				| components["schemas"]["WithVector"]
				| (Record<string, unknown> | null);
			/** @description Options for specifying which payload to include or not. Default is false. */
			with_payload?:
				| components["schemas"]["WithPayloadInterface"]
				| (Record<string, unknown> | null);
			/**
			 * @description The location to use for IDs lookup, if not specified - use the current collection and the 'using' vector Note: the other collection vectors should have the same vector size as the 'using' vector in the current collection
			 * @default null
			 */
			lookup_from?:
				| components["schemas"]["LookupLocation"]
				| (Record<string, unknown> | null);
		};
		Prefetch: {
			/**
			 * @description Sub-requests to perform first. If present, the query will be performed on the results of the prefetches.
			 * @default null
			 */
			prefetch?:
				| components["schemas"]["Prefetch"]
				| components["schemas"]["Prefetch"][]
				| (Record<string, unknown> | null);
			/** @description Query to perform. If missing without prefetches, returns points ordered by their IDs. */
			query?:
				| components["schemas"]["QueryInterface"]
				| (Record<string, unknown> | null);
			/** @description Define which vector name to use for querying. If missing, the default vector is used. */
			using?: string | null;
			/** @description Filter conditions - return only those points that satisfy the specified conditions. */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/** @description Search params for when there is no prefetch */
			params?:
				| components["schemas"]["SearchParams"]
				| (Record<string, unknown> | null);
			/**
			 * Format: float
			 * @description Return points with scores better than this threshold.
			 */
			score_threshold?: number | null;
			/**
			 * Format: uint
			 * @description Max number of points to return. Default is 10.
			 */
			limit?: number | null;
			/**
			 * @description The location to use for IDs lookup, if not specified - use the current collection and the 'using' vector Note: the other collection vectors should have the same vector size as the 'using' vector in the current collection
			 * @default null
			 */
			lookup_from?:
				| components["schemas"]["LookupLocation"]
				| (Record<string, unknown> | null);
		};
		QueryInterface:
			| components["schemas"]["VectorInput"]
			| components["schemas"]["Query"];
		VectorInput:
			| number[]
			| components["schemas"]["SparseVector"]
			| number[][]
			| components["schemas"]["ExtendedPointId"]
			| components["schemas"]["Document"]
			| components["schemas"]["Image"]
			| components["schemas"]["InferenceObject"];
		Query:
			| components["schemas"]["NearestQuery"]
			| components["schemas"]["RecommendQuery"]
			| components["schemas"]["DiscoverQuery"]
			| components["schemas"]["ContextQuery"]
			| components["schemas"]["OrderByQuery"]
			| components["schemas"]["FusionQuery"]
			| components["schemas"]["FormulaQuery"]
			| components["schemas"]["SampleQuery"];
		NearestQuery: {
			nearest: components["schemas"]["VectorInput"];
		};
		RecommendQuery: {
			recommend: components["schemas"]["RecommendInput"];
		};
		RecommendInput: {
			/** @description Look for vectors closest to the vectors from these points */
			positive?: components["schemas"]["VectorInput"][] | null;
			/** @description Try to avoid vectors like the vector from these points */
			negative?: components["schemas"]["VectorInput"][] | null;
			/** @description How to use the provided vectors to find the results */
			strategy?:
				| components["schemas"]["RecommendStrategy"]
				| (Record<string, unknown> | null);
		};
		DiscoverQuery: {
			discover: components["schemas"]["DiscoverInput"];
		};
		DiscoverInput: {
			target: components["schemas"]["VectorInput"];
			/** @description Search space will be constrained by these pairs of vectors */
			context:
				| components["schemas"]["ContextPair"]
				| components["schemas"]["ContextPair"][]
				| (Record<string, unknown> | null);
		};
		ContextPair: {
			positive: components["schemas"]["VectorInput"];
			negative: components["schemas"]["VectorInput"];
		};
		ContextQuery: {
			context: components["schemas"]["ContextInput"];
		};
		ContextInput:
			| components["schemas"]["ContextPair"]
			| components["schemas"]["ContextPair"][]
			| (Record<string, unknown> | null);
		OrderByQuery: {
			order_by: components["schemas"]["OrderByInterface"];
		};
		FusionQuery: {
			fusion: components["schemas"]["Fusion"];
		};
		/**
		 * @description Fusion algorithm allows to combine results of multiple prefetches.
		 *
		 * Available fusion algorithms:
		 *
		 * * `rrf` - Reciprocal Rank Fusion * `dbsf` - Distribution-Based Score Fusion
		 * @enum {string}
		 */
		Fusion: "rrf" | "dbsf";
		FormulaQuery: {
			formula: components["schemas"]["Expression"];
			/** @default {} */
			defaults?: {
				[key: string]: unknown;
			};
		};
		Expression:
			| number
			| string
			| components["schemas"]["Condition"]
			| components["schemas"]["GeoDistance"]
			| components["schemas"]["DatetimeExpression"]
			| components["schemas"]["DatetimeKeyExpression"]
			| components["schemas"]["MultExpression"]
			| components["schemas"]["SumExpression"]
			| components["schemas"]["NegExpression"]
			| components["schemas"]["AbsExpression"]
			| components["schemas"]["DivExpression"]
			| components["schemas"]["SqrtExpression"]
			| components["schemas"]["PowExpression"]
			| components["schemas"]["ExpExpression"]
			| components["schemas"]["Log10Expression"]
			| components["schemas"]["LnExpression"]
			| components["schemas"]["LinDecayExpression"]
			| components["schemas"]["ExpDecayExpression"]
			| components["schemas"]["GaussDecayExpression"];
		GeoDistance: {
			geo_distance: components["schemas"]["GeoDistanceParams"];
		};
		GeoDistanceParams: {
			origin: components["schemas"]["GeoPoint"];
			/** @description Payload field with the destination geo point */
			to: string;
		};
		DatetimeExpression: {
			datetime: string;
		};
		DatetimeKeyExpression: {
			datetime_key: string;
		};
		MultExpression: {
			mult: components["schemas"]["Expression"][];
		};
		SumExpression: {
			sum: components["schemas"]["Expression"][];
		};
		NegExpression: {
			neg: components["schemas"]["Expression"];
		};
		AbsExpression: {
			abs: components["schemas"]["Expression"];
		};
		DivExpression: {
			div: components["schemas"]["DivParams"];
		};
		DivParams: {
			left: components["schemas"]["Expression"];
			right: components["schemas"]["Expression"];
			/** Format: float */
			by_zero_default?: number | null;
		};
		SqrtExpression: {
			sqrt: components["schemas"]["Expression"];
		};
		PowExpression: {
			pow: components["schemas"]["PowParams"];
		};
		PowParams: {
			base: components["schemas"]["Expression"];
			exponent: components["schemas"]["Expression"];
		};
		ExpExpression: {
			exp: components["schemas"]["Expression"];
		};
		Log10Expression: {
			log10: components["schemas"]["Expression"];
		};
		LnExpression: {
			ln: components["schemas"]["Expression"];
		};
		LinDecayExpression: {
			lin_decay: components["schemas"]["DecayParamsExpression"];
		};
		DecayParamsExpression: {
			x: components["schemas"]["Expression"];
			/** @description The target value to start decaying from. Defaults to 0. */
			target?:
				| components["schemas"]["Expression"]
				| (Record<string, unknown> | null);
			/**
			 * Format: float
			 * @description The scale factor of the decay, in terms of `x`. Defaults to 1.0. Must be a non-zero positive number.
			 */
			scale?: number | null;
			/**
			 * Format: float
			 * @description The midpoint of the decay. Defaults to 0.5. Output will be this value when `|x - target| == scale`.
			 */
			midpoint?: number | null;
		};
		ExpDecayExpression: {
			exp_decay: components["schemas"]["DecayParamsExpression"];
		};
		GaussDecayExpression: {
			gauss_decay: components["schemas"]["DecayParamsExpression"];
		};
		SampleQuery: {
			sample: components["schemas"]["Sample"];
		};
		/** @enum {string} */
		Sample: "random";
		QueryRequestBatch: {
			searches: components["schemas"]["QueryRequest"][];
		};
		QueryResponse: {
			points: components["schemas"]["ScoredPoint"][];
		};
		QueryGroupsRequest: {
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			/**
			 * @description Sub-requests to perform first. If present, the query will be performed on the results of the prefetch(es).
			 * @default null
			 */
			prefetch?:
				| components["schemas"]["Prefetch"]
				| components["schemas"]["Prefetch"][]
				| (Record<string, unknown> | null);
			/** @description Query to perform. If missing without prefetches, returns points ordered by their IDs. */
			query?:
				| components["schemas"]["QueryInterface"]
				| (Record<string, unknown> | null);
			/** @description Define which vector name to use for querying. If missing, the default vector is used. */
			using?: string | null;
			/** @description Filter conditions - return only those points that satisfy the specified conditions. */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/** @description Search params for when there is no prefetch */
			params?:
				| components["schemas"]["SearchParams"]
				| (Record<string, unknown> | null);
			/**
			 * Format: float
			 * @description Return points with scores better than this threshold.
			 */
			score_threshold?: number | null;
			/** @description Options for specifying which vectors to include into the response. Default is false. */
			with_vector?:
				| components["schemas"]["WithVector"]
				| (Record<string, unknown> | null);
			/** @description Options for specifying which payload to include or not. Default is false. */
			with_payload?:
				| components["schemas"]["WithPayloadInterface"]
				| (Record<string, unknown> | null);
			/**
			 * @description The location to use for IDs lookup, if not specified - use the current collection and the 'using' vector Note: the other collection vectors should have the same vector size as the 'using' vector in the current collection
			 * @default null
			 */
			lookup_from?:
				| components["schemas"]["LookupLocation"]
				| (Record<string, unknown> | null);
			/** @description Payload field to group by, must be a string or number field. If the field contains more than 1 value, all values will be used for grouping. One point can be in multiple groups. */
			group_by: string;
			/**
			 * Format: uint
			 * @description Maximum amount of points to return per group. Default is 3.
			 */
			group_size?: number | null;
			/**
			 * Format: uint
			 * @description Maximum amount of groups to return. Default is 10.
			 */
			limit?: number | null;
			/** @description Look for points in another collection using the group ids */
			with_lookup?:
				| components["schemas"]["WithLookupInterface"]
				| (Record<string, unknown> | null);
		};
		SearchMatrixRequest: {
			/** @description Specify in which shards to look for the points, if not specified - look in all shards */
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			/** @description Look only for points which satisfies this conditions */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/**
			 * Format: uint
			 * @description How many points to select and search within. Default is 10.
			 */
			sample?: number | null;
			/**
			 * Format: uint
			 * @description How many neighbours per sample to find. Default is 3.
			 */
			limit?: number | null;
			/** @description Define which vector name to use for querying. If missing, the default vector is used. */
			using?: string | null;
		};
		SearchMatrixOffsetsResponse: {
			/** @description Row indices of the matrix */
			offsets_row: number[];
			/** @description Column indices of the matrix */
			offsets_col: number[];
			/** @description Scores associated with matrix coordinates */
			scores: number[];
			/** @description Ids of the points in order */
			ids: components["schemas"]["ExtendedPointId"][];
		};
		SearchMatrixPairsResponse: {
			/** @description List of pairs of points with scores */
			pairs: components["schemas"]["SearchMatrixPair"][];
		};
		/** @description Pair of points (a, b) with score */
		SearchMatrixPair: {
			a: components["schemas"]["ExtendedPointId"];
			b: components["schemas"]["ExtendedPointId"];
			/** Format: float */
			score: number;
		};
		FacetRequest: {
			shard_key?:
				| components["schemas"]["ShardKeySelector"]
				| (Record<string, unknown> | null);
			/** @description Payload key to use for faceting. */
			key: string;
			/**
			 * Format: uint
			 * @description Max number of hits to return. Default is 10.
			 */
			limit?: number | null;
			/** @description Filter conditions - only consider points that satisfy these conditions. */
			filter?:
				| components["schemas"]["Filter"]
				| (Record<string, unknown> | null);
			/** @description Whether to do a more expensive exact count for each of the values in the facet. Default is false. */
			exact?: boolean | null;
		};
		FacetResponse: {
			hits: components["schemas"]["FacetValueHit"][];
		};
		FacetValueHit: {
			value: components["schemas"]["FacetValue"];
			/** Format: uint */
			count: number;
		};
		FacetValue: string | number | boolean;
	};
	responses: never;
	parameters: never;
	requestBodies: never;
	headers: never;
	pathItems: never;
}

export type SchemaFor<
	K extends keyof T,
	T extends object = components["schemas"],
> = T[K];

export interface QdrantPoint {
	id: string | number;
	version: number;
	score: number;
	payload:
		| Record<string, unknown>
		| {
				[key: string]: unknown;
		  }
		| null
		| undefined;
	vector:
		| Record<string, unknown>
		| number[]
		| number[][]
		| {
				[key: string]:
					| number[]
					| number[][]
					| {
							indices: number[];
							values: number[];
					  }
					| undefined;
		  }
		| null
		| undefined;
	shard_key: string | number | Record<string, unknown> | null | undefined;
	order_value: number | Record<string, unknown> | null | undefined;
}

export interface QdrantResult {
	points: QdrantPoint[];
}

export interface QdrantSearchCriteria {
	key: string;
	value: string;
}

export interface QdrantClientInterface {
	createCollection(
		name: string,
		config: {
			vectors: {
				size: number;
				distance: string;
			};
		},
	): Promise<boolean>;
	deleteCollection(name: string): Promise<boolean>;
	getCollection(name: string): Promise<unknown>;
	getCollections(): Promise<unknown>;
	collectionExists(name: string): Promise<{ exists: boolean }>;
	upsert(collection: string, data: unknown): Promise<unknown>;
	query(
		collection_name: string,
		request: {
			consistency?: SchemaFor<"ReadConsistency">;
			timeout?: number;
		} & SchemaFor<"QueryRequest">,
	): Promise<QdrantResult>;
	count(
		collection_name: string,
		{
			shard_key,
			filter,
			exact,
			timeout,
		}?: SchemaFor<"CountRequest"> & {
			timeout?: number;
		},
	): Promise<{
		count: number;
	}>;
}

export interface CollectionParams {
	status: "green" | "yellow" | "grey" | "red";
	optimizer_status:
		| "ok"
		| {
				error: string;
		  };
	vectors_count?: number | null | undefined;
	indexed_vectors_count?: number | null | undefined;
	points_count?: number | null | undefined;
	segments_count: number;
	config: {
		params: {
			vectors?:
				| {
						size: number;
						distance: "Cosine" | "Euclid" | "Dot" | "Manhattan";
						hnsw_config?:
							| Record<string, unknown>
							| {
									m?: number | null | undefined;
									ef_construct?: number | null | undefined;
									full_scan_threshold?: number | null | undefined;
									max_indexing_threads?: number | null | undefined;
									on_disk?: boolean | null | undefined;
									payload_m?: number | null | undefined;
							  }
							| null
							| undefined;
						quantization_config?:
							| Record<string, unknown>
							| {
									scalar: {
										type: "int8";
										quantile?: number | null | undefined;
										always_ram?: boolean | null | undefined;
									};
							  }
							| {
									product: {
										compression: "x4" | "x8" | "x16" | "x32" | "x64";
										always_ram?: boolean | null | undefined;
									};
							  }
							| {
									binary: {
										always_ram?: boolean | null | undefined;
									};
							  }
							| null
							| undefined;
						on_disk?: boolean | null | undefined;
						datatype?:
							| Record<string, unknown>
							| "float32"
							| "uint8"
							| "float16"
							| null
							| undefined;
						/**
						 * Delete vectors
						 * @param collection_name
						 * @param {object} args
						 *     - wait: Await for the results to be processed.
						 *         - If `true`, result will be returned only when all changes are applied
						 *         - If `false`, result will be returned immediately after the confirmation of receiving.
						 *         - Default: `true`
						 *     - ordering: Define strategy for ordering of the points. Possible values:
						 *          - 'weak'   - write operations may be reordered, works faster, default
						 *          - 'medium' - write operations go through dynamically selected leader,
						 *                      may be inconsistent for a short period of time in case of leader change
						 *          - 'strong' - Write operations go through the permanent leader,
						 *                      consistent, but may be unavailable if leader is down
						 *     - points: Deletes values from each point in this list
						 *     - filter: Deletes values from points that satisfy this filter condition
						 *     - vector: Vector names
						 *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
						 * @returns Operation result
						 */
						multivector_config?:
							| Record<string, unknown>
							| {
									comparator: "max_sim";
							  }
							| null
							| undefined;
				  }
				| {
						[key: string]:
							| {
									size: number;
									distance: "Cosine" | "Euclid" | "Dot" | "Manhattan";
									hnsw_config?:
										| Record<string, unknown>
										| {
												m?: number | null | undefined;
												ef_construct?: number | null | undefined;
												full_scan_threshold?: number | null | undefined;
												max_indexing_threads?: number | null | undefined;
												on_disk?: boolean | null | undefined;
												payload_m?: number | null | undefined;
										  }
										| null
										| undefined;
									quantization_config?:
										| Record<string, unknown>
										| {
												scalar: {
													type: "int8";
													quantile?: number | null | undefined;
													always_ram?: boolean | null | undefined;
												};
										  }
										| {
												product: {
													compression: "x4" | "x8" | "x16" | "x32" | "x64";
													always_ram?: boolean | null | undefined;
												};
										  }
										| {
												binary: {
													always_ram?: boolean | null | undefined;
												};
										  }
										| null
										| undefined;
									on_disk?: boolean | null | undefined;
									datatype?:
										| Record<string, unknown>
										| "float32"
										| "uint8"
										| "float16"
										| null
										| undefined;
									/**
									 * Delete vectors
									 * @param collection_name
									 * @param {object} args
									 *     - wait: Await for the results to be processed.
									 *         - If `true`, result will be returned only when all changes are applied
									 *         - If `false`, result will be returned immediately after the confirmation of receiving.
									 *         - Default: `true`
									 *     - ordering: Define strategy for ordering of the points. Possible values:
									 *          - 'weak'   - write operations may be reordered, works faster, default
									 *          - 'medium' - write operations go through dynamically selected leader,
									 *                      may be inconsistent for a short period of time in case of leader change
									 *          - 'strong' - Write operations go through the permanent leader,
									 *                      consistent, but may be unavailable if leader is down
									 *     - points: Deletes values from each point in this list
									 *     - filter: Deletes values from points that satisfy this filter condition
									 *     - vector: Vector names
									 *     - shard_key: Specify in which shards to look for the points, if not specified - look in all shards
									 * @returns Operation result
									 */
									multivector_config?:
										| Record<string, unknown>
										| {
												comparator: "max_sim";
										  }
										| null
										| undefined;
							  }
							| undefined;
				  }
				| undefined;
			shard_number?: number | undefined;
			sharding_method?:
				| Record<string, unknown>
				| "auto"
				| "custom"
				| null
				| undefined;
			replication_factor?: number | undefined;
			write_consistency_factor?: number | undefined;
			read_fan_out_factor?: number | null | undefined;
			on_disk_payload?: boolean | undefined;
			sparse_vectors?:
				| {
						[key: string]:
							| {
									index?:
										| Record<string, unknown>
										| {
												full_scan_threshold?: number | null | undefined;
												on_disk?: boolean | null | undefined;
												datatype?:
													| Record<string, unknown>
													| "float32"
													| "uint8"
													| "float16"
													| null
													| undefined;
										  }
										| null
										| undefined;
									modifier?:
										| Record<string, unknown>
										| "none"
										| "idf"
										| null
										| undefined;
							  }
							| undefined;
				  }
				| null
				| undefined;
		};
		hnsw_config: {
			m: number;
			ef_construct: number;
			full_scan_threshold: number;
			max_indexing_threads?: number | undefined;
			on_disk?: boolean | null | undefined;
			payload_m?: number | null | undefined;
		};
		optimizer_config: {
			deleted_threshold: number;
			vacuum_min_vector_number: number;
			default_segment_number: number;
			max_segment_size?: number | null | undefined;
			memmap_threshold?: number | null | undefined;
			indexing_threshold?: number | null | undefined;
			flush_interval_sec: number;
			max_optimization_threads?: number | null | undefined;
		};
		wal_config?:
			| Record<string, unknown>
			| {
					wal_capacity_mb: number;
					wal_segments_ahead: number;
			  }
			| null
			| undefined;
		quantization_config?:
			| Record<string, unknown>
			| {
					scalar: {
						type: "int8";
						quantile?: number | null | undefined;
						always_ram?: boolean | null | undefined;
					};
			  }
			| {
					product: {
						compression: "x4" | "x8" | "x16" | "x32" | "x64";
						always_ram?: boolean | null | undefined;
					};
			  }
			| {
					binary: {
						always_ram?: boolean | null | undefined;
					};
			  }
			| null
			| undefined;
		strict_mode_config?:
			| Record<string, unknown>
			| {
					enabled?: boolean | null | undefined;
					max_query_limit?: number | null | undefined;
					max_timeout?: number | null | undefined;
					unindexed_filtering_retrieve?: boolean | null | undefined;
					unindexed_filtering_update?: boolean | null | undefined;
					search_max_hnsw_ef?: number | null | undefined;
					search_allow_exact?: boolean | null | undefined;
					search_max_oversampling?: number | null | undefined;
					upsert_max_batchsize?: number | null | undefined;
					max_collection_vector_size_bytes?: number | null | undefined;
					read_rate_limit?: number | null | undefined;
					write_rate_limit?: number | null | undefined;
					max_collection_payload_size_bytes?: number | null | undefined;
					max_points_count?: number | null | undefined;
					filter_max_conditions?: number | null | undefined;
					condition_max_size?: number | null | undefined;
					multivector_config?:
						| Record<string, unknown>
						| {
								[key: string]:
									| {
											max_vectors?: number | null | undefined;
									  }
									| undefined;
						  }
						| null
						| undefined;
					sparse_config?:
						| Record<string, unknown>
						| {
								[key: string]:
									| {
											max_length?: number | null | undefined;
									  }
									| undefined;
						  }
						| null
						| undefined;
			  }
			| null
			| undefined;
	};
	payload_schema: {
		[key: string]:
			| {
					data_type:
						| "keyword"
						| "integer"
						| "float"
						| "geo"
						| "text"
						| "bool"
						| "datetime"
						| "uuid";
					params?:
						| Record<string, unknown>
						| {
								type: "keyword";
								is_tenant?: boolean | null | undefined;
								on_disk?: boolean | null | undefined;
						  }
						| {
								type: "integer";
								lookup?: boolean | null | undefined;
								range?: boolean | null | undefined;
								is_principal?: boolean | null | undefined;
								on_disk?: boolean | null | undefined;
						  }
						| {
								type: "float";
								is_principal?: boolean | null | undefined;
								on_disk?: boolean | null | undefined;
						  }
						| {
								type: "geo";
								on_disk?: boolean | null | undefined;
						  }
						| {
								type: "text";
								tokenizer?:
									| "prefix"
									| "whitespace"
									| "word"
									| "multilingual"
									| undefined;
								min_token_len?: number | null | undefined;
								max_token_len?: number | null | undefined;
								lowercase?: boolean | null | undefined;
								on_disk?: boolean | null | undefined;
						  }
						| {
								type: "bool";
								on_disk?: boolean | null | undefined;
						  }
						| {
								type: "datetime";
								is_principal?: boolean | null | undefined;
								on_disk?: boolean | null | undefined;
						  }
						| {
								type: "uuid";
								is_tenant?: boolean | null | undefined;
								on_disk?: boolean | null | undefined;
						  }
						| null
						| undefined;
					points: number;
			  }
			| undefined;
	};
}

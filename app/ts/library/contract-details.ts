import { hexToBytes } from "@zoltu/ethereum-transactions/converters.js"

export const GNOSIS_SAFE_PROXY_FACTORY_ADDRESS = 0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2n
export const GNOSIS_SAFE_MASTER_ADDRESS = 0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552n
export const GNOSIS_SAFE_DELAY_MODULE_MASTER_ADDRESS = 0xd54895B1121A2eE3f37b502F507631FA1331BED6n
export const GNOSIS_SAFE_DELAY_MODULE_PROXY_FACTORY_ADDRESS = 0x000000000000addb49795b0f9ba5bc298cdda236n
export const GNOSIS_SAFE_FALLBACK_HANDLER_ADDRESS = 0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4n
export const MULTISEND_CALL_ADDRESS = 0x40a2accbd92bca938b02010e17a5b8929b49130dn
export const UNISWAP_ROUTER_ADDRESS = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45n
export const UNISWAP_QUOTER_ADDRESS = 0x61fFE014bA17989E743c5F6cB21bF9697530B21en

export const ERC20_ABI = [
	{
		"inputs": [],
		"name": "name",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "symbol",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "decimals",
		"outputs": [
			{
				"internalType": "uint8",
				"name": "",
				"type": "uint8"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalSupply",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "balanceOf",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "transfer",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "sender",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "transferFrom",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "approve",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			}
		],
		"name": "allowance",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "Transfer",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "Approval",
		"type": "event"
	}
] as const

export const RECOVERABLE_WALLET_ABI = [
	{
		"name": "execute",
		"type": "function",
		"stateMutability": "payable",
		"inputs": [
			{"internalType": "address payable","name": "_to","type": "address"},
			{"internalType": "uint256","name": "_value","type": "uint256"},
			{"internalType": "bytes","name": "_data","type": "bytes"}
		],
		"outputs": [
			{"internalType": "bytes","name": "","type": "bytes"}
		],
	},
	{
		"name": "deploy",
		"type": "function",
		"stateMutability": "payable",
		"inputs": [
			{"internalType": "uint256","name": "_value","type": "uint256"},
			{"internalType": "bytes","name": "_data","type": "bytes"},
			{"internalType": "uint256","name": "_salt","type": "uint256"}
		],
		"outputs": [
			{"internalType": "address","name": "","type": "address"}
		],
	},
	{
		"name": "owner",
		"type": "function",
		"stateMutability": "view",
		"inputs": [],
		"outputs": [
			{"internalType": "address","name": "","type": "address"}
		],
	},
] as const

export const GNOSIS_SAFE_PROXY_FACTORY_ABI = [
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": false, "internalType": "contract GnosisSafeProxy", "name": "proxy", "type": "address" },
			{ "indexed": false, "internalType": "address", "name": "singleton", "type": "address" }
		],
		"name": "ProxyCreation",
		"type": "event"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "_singleton", "type": "address" },
			{ "internalType": "bytes", "name": "initializer", "type": "bytes" },
			{ "internalType": "uint256", "name": "saltNonce", "type": "uint256" }
		],
		"name": "calculateCreateProxyWithNonceAddress",
		"outputs": [
			{ "internalType": "contract GnosisSafeProxy", "name": "proxy", "type": "address" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "singleton", "type": "address" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" }
		],
		"name": "createProxy",
		"outputs": [
			{ "internalType": "contract GnosisSafeProxy", "name": "proxy", "type": "address" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "_singleton", "type": "address" },
			{ "internalType": "bytes", "name": "initializer", "type": "bytes" },
			{ "internalType": "uint256", "name": "saltNonce", "type": "uint256" },
			{ "internalType": "contract IProxyCreationCallback", "name": "callback", "type": "address" }
		],
		"name": "createProxyWithCallback",
		"outputs": [
			{ "internalType": "contract GnosisSafeProxy", "name": "proxy", "type": "address" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "_singleton", "type": "address" },
			{ "internalType": "bytes", "name": "initializer", "type": "bytes" },
			{ "internalType": "uint256", "name": "saltNonce", "type": "uint256" }
		],
		"name": "createProxyWithNonce",
		"outputs": [
			{ "internalType": "contract GnosisSafeProxy", "name": "proxy", "type": "address" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "proxyCreationCode",
		"outputs": [
			{ "internalType": "bytes", "name": "", "type": "bytes" }
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "proxyRuntimeCode",
		"outputs": [
			{ "internalType": "bytes", "name": "", "type": "bytes" }
		],
		"stateMutability": "pure",
		"type": "function"
	}
] as const

export const GNOSIS_SAFE_ABI = [
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [ { "indexed": false, "internalType": "address", "name": "owner", "type": "address" } ],
		"name": "AddedOwner",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "bytes32", "name": "approvedHash", "type": "bytes32" },
			{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" }
		],
		"name": "ApproveHash",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [ { "indexed": false, "internalType": "address", "name": "handler", "type": "address" } ],
		"name": "ChangedFallbackHandler",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [ { "indexed": false, "internalType": "address", "name": "guard", "type": "address" } ],
		"name": "ChangedGuard",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [ { "indexed": false, "internalType": "uint256", "name": "threshold", "type": "uint256" } ],
		"name": "ChangedThreshold",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [ { "indexed": false, "internalType": "address", "name": "module", "type": "address" } ],
		"name": "DisabledModule",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [ { "indexed": false, "internalType": "address", "name": "module", "type": "address" } ],
		"name": "EnabledModule",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": false, "internalType": "bytes32", "name": "txHash", "type": "bytes32" },
			{ "indexed": false, "internalType": "uint256", "name": "payment", "type": "uint256" }
		],
		"name": "ExecutionFailure",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [ { "indexed": true, "internalType": "address", "name": "module", "type": "address" } ],
		"name": "ExecutionFromModuleFailure",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [ { "indexed": true, "internalType": "address", "name": "module", "type": "address" } ],
		"name": "ExecutionFromModuleSuccess",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": false, "internalType": "bytes32", "name": "txHash", "type": "bytes32" },
			{ "indexed": false, "internalType": "uint256", "name": "payment", "type": "uint256" }
		],
		"name": "ExecutionSuccess",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [ { "indexed": false, "internalType": "address", "name": "owner", "type": "address" } ],
		"name": "RemovedOwner",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "sender", "type": "address" },
			{ "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" }
		],
		"name": "SafeReceived",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "initiator", "type": "address" },
			{ "indexed": false, "internalType": "address[]", "name": "owners", "type": "address[]" },
			{ "indexed": false, "internalType": "uint256", "name": "threshold", "type": "uint256" },
			{ "indexed": false, "internalType": "address", "name": "initializer", "type": "address" },
			{ "indexed": false, "internalType": "address", "name": "fallbackHandler", "type": "address" }
		],
		"name": "SafeSetup",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [ { "indexed": true, "internalType": "bytes32", "name": "msgHash", "type": "bytes32" } ],
		"name": "SignMsg",
		"type": "event"
	},
	{
		"stateMutability": "nonpayable",
		"type": "fallback"
	},
	{
		"inputs": [],
		"name": "VERSION",
		"outputs": [
			{ "internalType": "string", "name": "", "type": "string" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "owner", "type": "address" },
			{ "internalType": "uint256", "name": "_threshold", "type": "uint256" }
		],
		"name": "addOwnerWithThreshold",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "bytes32", "name": "hashToApprove", "type": "bytes32" }
		],
		"name": "approveHash",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "", "type": "address" },
			{ "internalType": "bytes32", "name": "", "type": "bytes32" }
		],
		"name": "approvedHashes",
		"outputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "uint256", "name": "_threshold", "type": "uint256" }
		],
		"name": "changeThreshold",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "bytes32", "name": "dataHash", "type": "bytes32" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "bytes", "name": "signatures", "type": "bytes" },
			{ "internalType": "uint256", "name": "requiredSignatures", "type": "uint256" }
		],
		"name": "checkNSignatures",
		"outputs": [],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "bytes32", "name": "dataHash", "type": "bytes32" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "bytes", "name": "signatures", "type": "bytes" }
		],
		"name": "checkSignatures",
		"outputs": [],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "prevModule", "type": "address" },
			{ "internalType": "address", "name": "module", "type": "address" }
		],
		"name": "disableModule",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "domainSeparator",
		"outputs": [
			{ "internalType": "bytes32", "name": "", "type": "bytes32" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "module", "type": "address" }
		],
		"name": "enableModule",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "enum Enum.Operation", "name": "operation", "type": "uint8" },
			{ "internalType": "uint256", "name": "safeTxGas", "type": "uint256" },
			{ "internalType": "uint256", "name": "baseGas", "type": "uint256" },
			{ "internalType": "uint256", "name": "gasPrice", "type": "uint256" },
			{ "internalType": "address", "name": "gasToken", "type": "address" },
			{ "internalType": "address", "name": "refundReceiver", "type": "address" },
			{ "internalType": "uint256", "name": "_nonce", "type": "uint256" }
		],
		"name": "encodeTransactionData",
		"outputs": [
			{ "internalType": "bytes", "name": "", "type": "bytes" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "enum Enum.Operation", "name": "operation", "type": "uint8" },
			{ "internalType": "uint256", "name": "safeTxGas", "type": "uint256" },
			{ "internalType": "uint256", "name": "baseGas", "type": "uint256" },
			{ "internalType": "uint256", "name": "gasPrice", "type": "uint256" },
			{ "internalType": "address", "name": "gasToken", "type": "address" },
			{ "internalType": "address payable", "name": "refundReceiver", "type": "address" },
			{ "internalType": "bytes", "name": "signatures", "type": "bytes" }
		],
		"name": "execTransaction",
		"outputs": [
			{ "internalType": "bool", "name": "success", "type": "bool" }
		],
		"stateMutability": "payable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "enum Enum.Operation", "name": "operation", "type": "uint8" }
		],
		"name": "execTransactionFromModule",
		"outputs": [
			{ "internalType": "bool", "name": "success", "type": "bool" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "enum Enum.Operation", "name": "operation", "type": "uint8" }
		],
		"name": "execTransactionFromModuleReturnData",
		"outputs": [
			{ "internalType": "bool", "name": "success", "type": "bool" },
			{ "internalType": "bytes", "name": "returnData", "type": "bytes" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getChainId",
		"outputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "start", "type": "address" },
			{ "internalType": "uint256", "name": "pageSize", "type": "uint256" }
		],
		"name": "getModulesPaginated",
		"outputs": [
			{ "internalType": "address[]", "name": "array", "type": "address[]" },
			{ "internalType": "address", "name": "next", "type": "address" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getOwners",
		"outputs": [
			{ "internalType": "address[]", "name": "", "type": "address[]" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "uint256", "name": "offset", "type": "uint256" },
			{ "internalType": "uint256", "name": "length", "type": "uint256" }
		],
		"name": "getStorageAt",
		"outputs": [
			{ "internalType": "bytes", "name": "", "type": "bytes" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getThreshold",
		"outputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "enum Enum.Operation", "name": "operation", "type": "uint8" },
			{ "internalType": "uint256", "name": "safeTxGas", "type": "uint256" },
			{ "internalType": "uint256", "name": "baseGas", "type": "uint256" },
			{ "internalType": "uint256", "name": "gasPrice", "type": "uint256" },
			{ "internalType": "address", "name": "gasToken", "type": "address" },
			{ "internalType": "address", "name": "refundReceiver", "type": "address" },
			{ "internalType": "uint256", "name": "_nonce", "type": "uint256" }
		],
		"name": "getTransactionHash",
		"outputs": [
			{ "internalType": "bytes32", "name": "", "type": "bytes32" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "module", "type": "address" }
		],
		"name": "isModuleEnabled",
		"outputs": [
			{ "internalType": "bool", "name": "", "type": "bool" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "owner", "type": "address" }
		],
		"name": "isOwner",
		"outputs": [
			{ "internalType": "bool", "name": "", "type": "bool" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "nonce",
		"outputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "prevOwner", "type": "address" },
			{ "internalType": "address", "name": "owner", "type": "address" },
			{ "internalType": "uint256", "name": "_threshold", "type": "uint256" }
		],
		"name": "removeOwner",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "enum Enum.Operation", "name": "operation", "type": "uint8" }
		],
		"name": "requiredTxGas",
		"outputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "handler", "type": "address" }
		],
		"name": "setFallbackHandler",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "guard", "type": "address" }
		],
		"name": "setGuard",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address[]", "name": "_owners", "type": "address[]" },
			{ "internalType": "uint256", "name": "_threshold", "type": "uint256" },
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "address", "name": "fallbackHandler", "type": "address" },
			{ "internalType": "address", "name": "paymentToken", "type": "address" },
			{ "internalType": "uint256", "name": "payment", "type": "uint256" },
			{ "internalType": "address payable", "name": "paymentReceiver", "type": "address" }
		],
		"name": "setup",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "bytes32", "name": "", "type": "bytes32" }
		],
		"name": "signedMessages",
		"outputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "targetContract", "type": "address" },
			{ "internalType": "bytes", "name": "calldataPayload", "type": "bytes" }
		],
		"name": "simulateAndRevert",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "prevOwner", "type": "address" },
			{ "internalType": "address", "name": "oldOwner", "type": "address" },
			{ "internalType": "address", "name": "newOwner", "type": "address" }
		],
		"name": "swapOwner",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"stateMutability": "payable",
		"type": "receive"
	}
] as const

export const GNOSIS_SAFE_DELAY_MODULE_ABI = [
	{
		"inputs": [
			{ "internalType": "address", "name": "_owner", "type": "address" },
			{ "internalType": "address", "name": "_avatar", "type": "address" },
			{ "internalType": "address", "name": "_target", "type": "address" },
			{ "internalType": "uint256", "name": "_cooldown", "type": "uint256" },
			{ "internalType": "uint256", "name": "_expiration", "type": "uint256" }
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "previousAvatar", "type": "address" },
			{ "indexed": true, "internalType": "address", "name": "newAvatar", "type": "address" }
		],
		"name": "AvatarSet",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": false, "internalType": "address", "name": "guard", "type": "address" }
		],
		"name": "ChangedGuard",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "initiator", "type": "address" },
			{ "indexed": true, "internalType": "address", "name": "owner", "type": "address" },
			{ "indexed": true, "internalType": "address", "name": "avatar", "type": "address" },
			{ "indexed": false, "internalType": "address", "name": "target", "type": "address" }
		],
		"name": "DelaySetup",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": false, "internalType": "address", "name": "module", "type": "address" }
		],
		"name": "DisabledModule",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": false, "internalType": "address", "name": "module", "type": "address" }
		],
		"name": "EnabledModule",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "previousOwner", "type": "address" },
			{ "indexed": true, "internalType": "address", "name": "newOwner", "type": "address" }
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "previousTarget", "type": "address" },
			{ "indexed": true, "internalType": "address", "name": "newTarget", "type": "address" }
		],
		"name": "TargetSet",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "uint256", "name": "queueNonce", "type": "uint256" },
			{ "indexed": true, "internalType": "bytes32", "name": "txHash", "type": "bytes32" },
			{ "indexed": false, "internalType": "address", "name": "to", "type": "address" },
			{ "indexed": false, "internalType": "uint256", "name": "value", "type": "uint256" },
			{ "indexed": false, "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "indexed": false, "internalType": "enum Enum.Operation", "name": "operation", "type": "uint8" }
		],
		"name": "TransactionAdded",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "avatar",
		"outputs": [
			{ "internalType": "address", "name": "", "type": "address" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "prevModule", "type": "address" },
			{ "internalType": "address", "name": "module", "type": "address" }
		],
		"name": "disableModule",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "module", "type": "address" }
		],
		"name": "enableModule",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "enum Enum.Operation", "name": "operation", "type": "uint8" }
		],
		"name": "execTransactionFromModule",
		"outputs": [
			{ "internalType": "bool", "name": "success", "type": "bool" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "enum Enum.Operation", "name": "operation", "type": "uint8" }
		],
		"name": "execTransactionFromModuleReturnData",
		"outputs": [
			{ "internalType": "bool", "name": "success", "type": "bool" },
			{ "internalType": "bytes", "name": "returnData", "type": "bytes" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "enum Enum.Operation", "name": "operation", "type": "uint8" }
		],
		"name": "executeNextTx",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getGuard",
		"outputs": [
			{ "internalType": "address", "name": "_guard", "type": "address" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "start", "type": "address" },
			{ "internalType": "uint256", "name": "pageSize", "type": "uint256" }
		],
		"name": "getModulesPaginated",
		"outputs": [
			{ "internalType": "address[]", "name": "array", "type": "address[]" },
			{ "internalType": "address", "name": "next", "type": "address" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "to", "type": "address" },
			{ "internalType": "uint256", "name": "value", "type": "uint256" },
			{ "internalType": "bytes", "name": "data", "type": "bytes" },
			{ "internalType": "enum Enum.Operation", "name": "operation", "type": "uint8" }
		],
		"name": "getTransactionHash",
		"outputs": [
			{ "internalType": "bytes32", "name": "", "type": "bytes32" }
		],
		"stateMutability": "pure",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "uint256", "name": "_nonce", "type": "uint256" }
		],
		"name": "getTxCreatedAt",
		"outputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "uint256", "name": "_nonce", "type": "uint256" }
		],
		"name": "getTxHash",
		"outputs": [
			{ "internalType": "bytes32", "name": "", "type": "bytes32" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "guard",
		"outputs": [
			{ "internalType": "address", "name": "", "type": "address" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "_module", "type": "address" }
		],
		"name": "isModuleEnabled",
		"outputs": [
			{ "internalType": "bool", "name": "", "type": "bool" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{ "internalType": "address", "name": "", "type": "address" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "queueNonce",
		"outputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "renounceOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "_avatar", "type": "address" }
		],
		"name": "setAvatar",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "_guard", "type": "address" }
		],
		"name": "setGuard",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "_target", "type": "address" }
		],
		"name": "setTarget",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "uint256", "name": "cooldown", "type": "uint256" }
		],
		"name": "setTxCooldown",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "uint256", "name": "expiration", "type": "uint256" }
		],
		"name": "setTxExpiration",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "uint256", "name": "_nonce", "type": "uint256" }
		],
		"name": "setTxNonce",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "bytes", "name": "initParams", "type": "bytes" }
		],
		"name": "setUp",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "skipExpired",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "target",
		"outputs": [
			{ "internalType": "address", "name": "", "type": "address" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "newOwner", "type": "address" }
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "txCooldown",
		"outputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"name": "txCreatedAt",
		"outputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "txExpiration",
		"outputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"name": "txHash",
		"outputs": [
			{ "internalType": "bytes32", "name": "", "type": "bytes32" }
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "txNonce",
		"outputs": [
			{ "internalType": "uint256", "name": "", "type": "uint256" }
		],
		"stateMutability": "view",
		"type": "function"
	}
] as const

export const GNOSIS_SAFE_DELAY_MODULE_PROXY_FACTORY_ABI = [
	{
		"inputs": [],
		"name": "FailedInitialization",
		"type": "error"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "address_", "type": "address" }
		],
		"name": "TakenAddress",
		"type": "error"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "target", "type": "address" }
		],
		"name": "TargetHasNoCode",
		"type": "error"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "target", "type": "address" }
		],
		"name": "ZeroAddress",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "address", "name": "proxy", "type": "address" },
			{ "indexed": true, "internalType": "address", "name": "masterCopy", "type": "address" }
		],
		"name": "ModuleProxyCreation",
		"type": "event"
	},
	{
		"inputs": [
			{ "internalType": "address", "name": "masterCopy", "type": "address" },
			{ "internalType": "bytes", "name": "initializer", "type": "bytes" },
			{ "internalType": "uint256", "name": "saltNonce", "type": "uint256" }
		],
		"name": "deployModule",
		"outputs": [
			{ "internalType": "address", "name": "proxy", "type": "address" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	}
] as const

export const MULTISEND_CALL_ABI = [
	{
		"inputs":[
			{ "internalType": "bytes", "name": "transactions", "type": "bytes" }
		],
		"name": "multiSend",
		"outputs": [],
		"stateMutability": "payable", "type": "function"
	}
] as const

export const ROUTER_ABI = [
	{
		"name":"exactInputSingle",
		"type":"function",
		"stateMutability":"payable",
		"inputs": [
			{ "components": [ {"internalType":"address","name":"tokenIn","type":"address"}, {"internalType":"address","name":"tokenOut","type":"address"}, {"internalType":"uint24","name":"fee","type":"uint24"}, {"internalType":"address","name":"recipient","type":"address"}, {"internalType":"uint256","name":"amountIn","type":"uint256"}, {"internalType":"uint256","name":"amountOutMinimum","type":"uint256"}, {"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}, ], "internalType":"struct IV3SwapRouter.ExactInputSingleParams", "name":"params", "type":"tuple", },
		],
		"outputs": [
			{"internalType":"uint256","name":"amountOut","type":"uint256"},
		],
	},
	{
		"name":"exactOutputSingle",
		"type":"function",
		"stateMutability":"payable",
		"inputs": [
			{ "components": [ {"internalType":"address","name":"tokenIn","type":"address"}, {"internalType":"address","name":"tokenOut","type":"address"}, {"internalType":"uint24","name":"fee","type":"uint24"}, {"internalType":"address","name":"recipient","type":"address"}, {"internalType":"uint256","name":"amountOut","type":"uint256"}, {"internalType":"uint256","name":"amountInMaximum","type":"uint256"}, {"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}, ], "internalType":"struct IV3SwapRouter.ExactOutputSingleParams", "name":"params", "type":"tuple", },
		],
		"outputs": [
			{"internalType":"uint256","name":"amountIn","type":"uint256"},
		],
	},
	{
		"name":"wrapETH",
		"type":"function",
		"stateMutability":"payable",
		"inputs": [
			{"internalType":"uint256","name":"value","type":"uint256"},
		],
		"outputs":[],
	},
	{
		"name":"refundETH",
		"type":"function",
		"stateMutability":"payable",
		"inputs":[],
		"outputs":[],
	},
	{
		"name":"unwrapWETH9",
		"type":"function",
		"stateMutability":"payable",
		"inputs": [
			{"internalType":"uint256","name":"amountMinimum","type":"uint256"},
			{"internalType":"address","name":"recipient","type":"address"},
		],
		"outputs":[],
	},
	{
		"name":"sweepToken",
		"type":"function",
		"stateMutability":"payable",
		"inputs": [
			{"internalType":"address","name":"token","type":"address"},
			{"internalType":"uint256","name":"amountMinimum","type":"uint256"},
			{"internalType":"address","name":"recipient","type":"address"},
		],
		"outputs":[],
	},
	{
		"type":"function",
		"stateMutability":"payable",
		"name":"multicall",
		"inputs": [
			{"internalType":"uint256","name":"deadline","type":"uint256"},
			{"internalType":"bytes[]","name":"data","type":"bytes[]"},
		],
		"outputs": [
			{"internalType":"bytes[]","name":"","type":"bytes[]"},
		],
	},
] as const

export const QUOTER_ABI = [
	{
		"inputs": [
			{ "components": [ { "internalType": "address", "name": "tokenIn", "type": "address" }, { "internalType": "address", "name": "tokenOut", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "uint24", "name": "fee", "type": "uint24" }, { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" } ], "internalType": "struct IQuoterV2.QuoteExactOutputSingleParams", "name": "params", "type": "tuple" }
		],
		"name": "quoteExactOutputSingle",
		"outputs": [
			{ "internalType": "uint256", "name": "amountIn", "type": "uint256" },
			{ "internalType": "uint160", "name": "sqrtPriceX96After", "type": "uint160" },
			{ "internalType": "uint32", "name": "initializedTicksCrossed", "type": "uint32" },
			{ "internalType": "uint256", "name": "gasEstimate", "type": "uint256" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "components": [ { "internalType": "address", "name": "tokenIn", "type": "address" }, { "internalType": "address", "name": "tokenOut", "type": "address" }, { "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint24", "name": "fee", "type": "uint24" }, { "internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160" } ], "internalType": "struct IQuoterV2.QuoteExactInputSingleParams", "name": "params", "type": "tuple" }
		],
		"name": "quoteExactInputSingle",
		"outputs": [
			{ "internalType": "uint256", "name": "amountOut", "type": "uint256" },
			{ "internalType": "uint160", "name": "sqrtPriceX96After", "type": "uint160" },
			{ "internalType": "uint32", "name": "initializedTicksCrossed", "type": "uint32" },
			{ "internalType": "uint256", "name": "gasEstimate", "type": "uint256" }
		],
		"stateMutability": "nonpayable",
		"type": "function"
	}
] as const

export const GNOSIS_SAFE_PROXY_DEPLOYMENT_BYTECODE = hexToBytes('0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea2646970667358221220d1429297349653a4918076d650332de1a1068c5f3e07c5c82360c277770b955264736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564')

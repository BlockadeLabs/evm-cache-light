CREATE TYPE CONTRACT_STANDARD_TYPE as ENUM(
	'erc20',
	'erc165',
	'erc721',
	'erc777',
	'erc998',
	'erc1155'
);

CREATE TABLE contract_meta (
	"contract_meta_id" BIGSERIAL PRIMARY KEY,
	"address"          BYTEA NOT NULL UNIQUE,
	"standard"         CONTRACT_STANDARD_TYPE,
	"abi"              JSONB,
	"name"             TEXT,
	"symbol"           TEXT,
	"custom_name"      TEXT, -- Provided directly as an override

	-- Metadata override support
	-- Example: Cryptokitties has tokenMetadata(uint256, string), and ERC1155 has a metadata extension
	"token_uri_json_interface"            JSONB,
	"token_uri_json_interface_parameters" JSONB,

	-- Example: Cryptokitties has another public API that also requires an API key
	"custom_token_uri"         TEXT,
	"custom_token_uri_headers" JSONB
);

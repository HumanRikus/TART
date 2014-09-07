module fifo_sdram_fifo_scheduler(
   input rst,
   input spi_start_aq,
   input write_clk,

   input bb_clk,
   output reg bb_filled=0,
   input cmd_ready,
   output reg cmd_enable = 0,
   output reg cmd_wr = 0,
   output reg [SDRAM_ADDRESS_WIDTH-2:0] cmd_address  = 0,
   output reg tx_ready_for_first_read=0,
   input [4:0] tx_status_cnt,
   output reg [2:0] tart_state = AQ_WAITING,
   output reg [8:0] aq_bb_rd_address = 9'b0,
   output reg [8:0] aq_bb_wr_address = 9'b0
   );


   parameter SDRAM_ADDRESS_WIDTH = 22;
   parameter BLOCKSIZE = 8'd32;

   // 1 bit bigger than needed.
   parameter FILL_THRESHOLD = (22'h1FFFFF);
   // 1 bit bigger than needed.
   reg [SDRAM_ADDRESS_WIDTH-1:0] sdram_wr_ptr = 0;
   reg [SDRAM_ADDRESS_WIDTH-1:0] sdram_rd_ptr = 0;

   reg [1:0] Sync_start = 2'b0;
   // new signal synchronized to (=ready to be used in) clkB domain
   wire spi_start_aq_int; assign spi_start_aq_int = Sync_start[1];

   always @(posedge write_clk or posedge rst)
      begin
         if (rst)
            begin
              aq_bb_wr_address <= 9'b0;
              Sync_start <= 2'b00;
            end
         else
           begin
             Sync_start[0] <= spi_start_aq;
             Sync_start[1] <= Sync_start[0];
             if (spi_start_aq_int) aq_bb_wr_address <= aq_bb_wr_address + 1'b1;
           end
      end

   parameter AQ_WAITING         = 3'd0;
   parameter AQ_BUFFER_TO_SDRAM = 3'd1;
   parameter TX_WRITING         = 3'd2;
   parameter TX_IDLE            = 3'd3;
   parameter FINISHED           = 3'd4;

   reg [5:0] rcnt = 6'b0;

   always @(posedge bb_clk or posedge rst)
      begin
         if (rst)
            begin
               sdram_wr_ptr <= 22'b0; // 1 bit bigger than needed.
               sdram_rd_ptr <= 22'b0; // 1 bit bigger than needed.
               tart_state   <= AQ_WAITING;
               cmd_enable <= 1'b0;
               cmd_wr    <= 1'b0;
               bb_filled <= 1'b0;
               aq_bb_rd_address <= 9'b0;
            end
         else
            case (tart_state)
               AQ_WAITING:
                  begin
                     if (sdram_wr_ptr >= FILL_THRESHOLD)            tart_state <= TX_WRITING;
                     else if (aq_bb_rd_address != aq_bb_wr_address) tart_state <= AQ_BUFFER_TO_SDRAM;
                  end
               AQ_BUFFER_TO_SDRAM:
                  begin
                     if (cmd_enable) cmd_enable <= 0;
                     else if (cmd_ready)
                        begin
                           cmd_wr       <= 1'b1;
                           cmd_enable   <= 1'b1;
                           cmd_address  <= sdram_wr_ptr;
                           sdram_wr_ptr <= sdram_wr_ptr + 1'b1;
                           aq_bb_rd_address <= aq_bb_rd_address + 1'b1;
                           tart_state <= AQ_WAITING;
                        end
                  end
               TX_WRITING:
                  begin
                     bb_filled <= 1'b1;
                     if (tx_status_cnt > 5'd15)
                        begin
                           tx_ready_for_first_read <= 1'b1;
                           tart_state <= TX_IDLE;
                        end
                     else
                        begin
                           if (cmd_enable) cmd_enable <= 1'b0;
                           else if (cmd_ready)
                             begin
                                cmd_wr       <= 1'b0;
                                cmd_enable   <= 1'b1;
                                cmd_address  <= sdram_rd_ptr;
                                sdram_rd_ptr <= sdram_rd_ptr + 1'b1;
                             end
                       end
                     end
               TX_IDLE:
                  begin
                     if (sdram_rd_ptr < FILL_THRESHOLD)
                        begin
                           if (tx_status_cnt<5'd5) tart_state <= TX_WRITING;
                        end
                     else tart_state <= FINISHED;
                  end
               FINISHED:
                  begin
                     $display("Finished.");
                  end
            endcase
      end
endmodule
